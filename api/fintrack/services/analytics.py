from __future__ import annotations

from collections import defaultdict
from datetime import date, datetime, timedelta
from decimal import Decimal
from zoneinfo import ZoneInfo

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..db.models import Account, AccountBalanceSnapshot, Connection, Transaction
from ..routers.schemas import AnalyticsOut, AnalyticsRange, CashFlowPoint, DebtAccountOut, DebtPoint, SpendingCategoryOut

RANGE_DAYS = {"1w": 6, "1m": 29, "3m": 89, "6m": 179, "1y": 364}
MOVEMENT_PREFIXES = ("TRANSFER_", "LOAN_PAYMENTS_")


def _bucket(day: date, range_value: AnalyticsRange) -> date:
    if range_value in {"1w", "1m"}:
        return day
    if range_value in {"3m", "6m"}:
        return day - timedelta(days=day.weekday())
    return day.replace(day=1)


def _buckets(start: date, end: date, range_value: AnalyticsRange) -> list[date]:
    first = _bucket(start, range_value)
    step = 1 if range_value in {"1w", "1m"} else 7 if range_value in {"3m", "6m"} else 0
    values: list[date] = []
    current = first
    while current <= end:
        values.append(current)
        current = current + timedelta(days=step) if step else (current.replace(day=28) + timedelta(days=4)).replace(day=1)
    return values


def _internal_movement(category: str | None) -> bool:
    return bool(category and category.startswith(MOVEMENT_PREFIXES))


async def build_analytics(
    db: AsyncSession,
    range_value: AnalyticsRange,
    timezone_name: str,
    start: date | None = None,
    end: date | None = None,
) -> AnalyticsOut:
    today = datetime.now(ZoneInfo(timezone_name)).date()
    active_transactions = select(Transaction.date, Transaction.amount, Transaction.category).join(Account).join(Connection).where(
        Account.active,
        Connection.status != "disconnected",
        ~Transaction.removed,
        ~Transaction.pending,
    )
    if range_value == "custom":
        if not start or not end:
            raise ValueError("Custom analytics requires a start and end date")
    elif range_value == "all":
        earliest = await db.scalar(select(func.min(Transaction.date)).join(Account).join(Connection).where(Account.active, Connection.status != "disconnected", ~Transaction.removed, ~Transaction.pending))
        start = earliest or today
    else:
        start = today - timedelta(days=RANGE_DAYS[range_value])
    end = end or today
    bucket_range: AnalyticsRange = range_value
    if range_value == "custom":
        bucket_range = "1m" if (end - start).days <= 31 else "6m" if (end - start).days <= 183 else "1y"
    rows = (await db.execute(active_transactions.where(Transaction.date.between(start, end)))).all()

    flow = defaultdict(lambda: {"spending": Decimal(), "inflows": Decimal(), "movements": Decimal()})
    categories: dict[str, Decimal] = defaultdict(Decimal)
    for transaction_date, amount, category in rows:
        bucket = flow[_bucket(transaction_date, bucket_range)]
        if _internal_movement(category):
            bucket["movements"] += abs(amount)
        elif amount > 0:
            bucket["spending"] += amount
            categories[category or "UNCATEGORIZED"] += amount
        else:
            bucket["inflows"] += abs(amount)

    cash_flow = [CashFlowPoint(date=value, **flow[value]) for value in _buckets(start, end, bucket_range)]
    spending_total = sum((point.spending for point in cash_flow), Decimal())
    spending_categories = [SpendingCategoryOut(category=category, amount=amount, share=(amount / spending_total if spending_total else Decimal())) for category, amount in sorted(categories.items(), key=lambda item: item[1], reverse=True)]

    debt_rows = (await db.execute(select(Account, Connection).join(Connection).where(Account.active, Connection.status != "disconnected", Account.type.in_(("credit", "loan")), Account.current_balance.is_not(None)).order_by(Account.type, Connection.institution_name, Account.name))).all()
    debt_accounts = [DebtAccountOut(account_id=account.id, institution_name=connection.institution_name, account_name=account.name, account_type=account.type, current_balance=account.current_balance) for account, connection in debt_rows]
    snapshot_base = select(AccountBalanceSnapshot.observed_on, AccountBalanceSnapshot.account_type, AccountBalanceSnapshot.current_balance).join(Account).join(Connection).where(Account.active, Connection.status != "disconnected")
    first_snapshot = await db.scalar(select(func.min(AccountBalanceSnapshot.observed_on)).join(Account).join(Connection).where(Account.active, Connection.status != "disconnected"))
    snapshots = (await db.execute(snapshot_base.where(AccountBalanceSnapshot.observed_on.between(start, end)).order_by(AccountBalanceSnapshot.observed_on))).all()
    history: dict[date, dict[str, Decimal]] = defaultdict(lambda: {"credit_card_debt": Decimal(), "loan_debt": Decimal()})
    for observed_on, account_type, current_balance in snapshots:
        history[observed_on]["credit_card_debt" if account_type == "credit" else "loan_debt"] += current_balance
    debt_history = [DebtPoint(date=observed_on, **values) for observed_on, values in sorted(history.items())]

    return AnalyticsOut(
        range=range_value,
        from_date=start,
        to_date=end,
        timezone=timezone_name,
        first_debt_snapshot=first_snapshot,
        debt_history_available=bool(first_snapshot),
        spending_total=spending_total,
        inflows_total=sum((point.inflows for point in cash_flow), Decimal()),
        movements_total=sum((point.movements for point in cash_flow), Decimal()),
        credit_card_debt=sum((row.current_balance for row in debt_accounts if row.account_type == "credit"), Decimal()),
        loan_debt=sum((row.current_balance for row in debt_accounts if row.account_type == "loan"), Decimal()),
        cash_flow=cash_flow,
        spending_categories=spending_categories,
        debt_history=debt_history,
        debt_accounts=debt_accounts,
    )
