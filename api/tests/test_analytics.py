from datetime import datetime, timedelta
from decimal import Decimal
from zoneinfo import ZoneInfo

import pytest
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from fintrack.db.meta import Base
from fintrack.db.models import Account, AccountBalanceSnapshot, Connection, Transaction
from fintrack.services.analytics import build_analytics


@pytest.mark.asyncio
async def test_analytics_excludes_pending_and_internal_movements(tmp_path):
    engine = create_async_engine(f"sqlite+aiosqlite:///{tmp_path / 'analytics.db'}")
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)
    Session = async_sessionmaker(engine, expire_on_commit=False)
    today = datetime.now(ZoneInfo("America/New_York")).date()
    async with Session() as db:
        connection = Connection(provider_item_id="item", institution_name="Bank")
        db.add(connection); await db.flush()
        checking = Account(connection_id=connection.id, provider_account_id="checking", name="Checking", type="depository", currency="USD", current_balance=Decimal("500"))
        card = Account(connection_id=connection.id, provider_account_id="card", name="Card", type="credit", currency="USD", current_balance=Decimal("120"))
        loan = Account(connection_id=connection.id, provider_account_id="loan", name="Loan", type="loan", currency="USD", current_balance=Decimal("1000"))
        db.add_all([checking, card, loan]); await db.flush()
        now = datetime.now(ZoneInfo("UTC"))
        db.add_all([
            Transaction(account_id=checking.id, provider_transaction_id="spend", date=today, amount=Decimal("30"), currency="USD", description="Groceries", category="FOOD_AND_DRINK_GROCERIES", provider_updated_at=now),
            Transaction(account_id=checking.id, provider_transaction_id="income", date=today, amount=Decimal("-50"), currency="USD", description="Refund", category="GENERAL_MERCHANDISE", provider_updated_at=now),
            Transaction(account_id=checking.id, provider_transaction_id="transfer", date=today, amount=Decimal("100"), currency="USD", description="Transfer", category="TRANSFER_OUT", provider_updated_at=now),
            Transaction(account_id=checking.id, provider_transaction_id="payment", date=today, amount=Decimal("200"), currency="USD", description="Payment", category="LOAN_PAYMENTS_CREDIT_CARD_PAYMENT", provider_updated_at=now),
            Transaction(account_id=checking.id, provider_transaction_id="pending", date=today, amount=Decimal("9"), currency="USD", description="Pending", pending=True, provider_updated_at=now),
            AccountBalanceSnapshot(account_id=card.id, observed_on=today - timedelta(days=1), account_type="credit", current_balance=Decimal("110")),
            AccountBalanceSnapshot(account_id=card.id, observed_on=today, account_type="credit", current_balance=Decimal("120")),
            AccountBalanceSnapshot(account_id=loan.id, observed_on=today, account_type="loan", current_balance=Decimal("1000")),
        ])
        await db.commit()
        result = await build_analytics(db, "1w", "America/New_York")
        assert result.spending_total == Decimal("30")
        assert result.inflows_total == Decimal("50")
        assert result.movements_total == Decimal("300")
        assert result.spending_categories[0].category == "FOOD_AND_DRINK_GROCERIES"
        assert result.credit_card_debt == Decimal("120") and result.loan_debt == Decimal("1000")
        assert result.first_debt_snapshot == today - timedelta(days=1)
        assert result.debt_history[-1].credit_card_debt == Decimal("120")
        assert result.debt_history[-1].loan_debt == Decimal("1000")
        custom = await build_analytics(db, "custom", "America/New_York", today, today)
        assert custom.range == "custom" and custom.from_date == today and len(custom.cash_flow) == 1
    await engine.dispose()
