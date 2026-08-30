"""Read-only MCP tools backed by the Fin Track database."""

from datetime import date, datetime, timedelta, timezone
from decimal import Decimal

from mcp.server.mcpserver import MCPServer
from mcp.types import ToolAnnotations
from sqlalchemy import and_, func, or_, select

from .core.config import get_settings
from .db.base import SessionLocal
from .db.models import Account, Connection, CreditCardLiability, Transaction

MAX_TRANSACTIONS = 200

MCP_TOOL_DOCS = (
    {
        "name": "get_financial_summary",
        "title": "Get financial summary",
        "description": "Cash, credit-card debt, net position, and connection freshness.",
        "parameters": (),
        "returns": "Decimal-string USD totals, last successful sync time, stale count, and error count.",
    },
    {
        "name": "list_accounts",
        "title": "List accounts",
        "description": "Active accounts and their current balances.",
        "parameters": (("account_type", "string", "Optional", "Filter by account type, for example `depository` or `credit`."),),
        "returns": "Account names, masks, institutions, balances, currency, and freshness metadata.",
    },
    {
        "name": "list_credit_cards",
        "title": "List credit cards",
        "description": "Active credit cards with statement and payment details.",
        "parameters": (),
        "returns": "Balances, limits, statement dates, minimum payments, due dates, APRs, and overdue status.",
    },
    {
        "name": "list_transactions",
        "title": "List transactions",
        "description": "Newest matching transactions, with a safe result limit.",
        "parameters": (
            ("account_id", "integer", "Optional", "Limit results to one account."),
            ("start_date", "YYYY-MM-DD", "Optional", "Include transactions on or after this date."),
            ("end_date", "YYYY-MM-DD", "Optional", "Include transactions on or before this date."),
            ("search", "string", "Optional", "Case-insensitive merchant-name or description search."),
            ("limit", "integer", "Optional; default 50; maximum 200", "Maximum transactions to return."),
        ),
        "returns": "Transactions ordered newest first and `truncated` when more matches exist.",
    },
    {
        "name": "get_transaction_statement",
        "title": "Get transaction statement",
        "description": "One account's stored transactions over a requested date range.",
        "parameters": (
            ("account_id", "integer", "Required", "The active account ID."),
            ("start_date", "YYYY-MM-DD", "Required", "First date in the inclusive range."),
            ("end_date", "YYYY-MM-DD", "Required", "Last date in the inclusive range."),
        ),
        "returns": "Account details, up to 200 transactions, and `truncated`. This is not a bank-issued PDF.",
    },
)


def value(item):
    if isinstance(item, Decimal):
        return format(item, "f")
    if isinstance(item, (date, datetime)):
        return item.isoformat()
    return item


def account_data(account: Account, connection: Connection) -> dict:
    return {
        "account_id": account.id,
        "institution_name": connection.institution_name,
        "name": account.name,
        "mask": account.mask,
        "type": account.type,
        "subtype": account.subtype,
        "currency": account.currency,
        "current_balance": value(account.current_balance),
        "available_balance": value(account.available_balance),
        "balance_at": value(account.balance_at),
        "connection_status": connection.status,
    }


def transaction_data(transaction: Transaction, account: Account, connection: Connection) -> dict:
    return {
        "id": transaction.id,
        "account_id": account.id,
        "account_name": account.name,
        "institution_name": connection.institution_name,
        "date": value(transaction.date),
        "authorized_date": value(transaction.authorized_date),
        "amount": value(transaction.amount),
        "currency": transaction.currency,
        "merchant_name": transaction.merchant_name,
        "description": transaction.description,
        "category": transaction.category,
        "pending": transaction.pending,
    }


def accessible_accounts():
    return select(Account, Connection).join(Connection).where(Account.active, Connection.status != "disconnected")


async def get_financial_summary() -> dict:
    """Get cash, credit-card debt, net position, and sync freshness."""
    async with SessionLocal() as db:
        accounts = (await db.scalars(select(Account).join(Connection).where(Account.active, Account.currency == "USD", Connection.status != "disconnected"))).all()
        connections = (await db.scalars(select(Connection).where(Connection.status != "disconnected"))).all()
    now = datetime.now(timezone.utc)
    stale_after = timedelta(hours=get_settings().sync.stale_hours)
    cash = sum((account.current_balance or Decimal() for account in accounts if account.type == "depository"), Decimal())
    debt = sum((account.current_balance or Decimal() for account in accounts if account.type == "credit"), Decimal())
    return {
        "cash": value(cash),
        "credit_card_debt": value(debt),
        "net_position": value(cash - debt),
        "currency": "USD",
        "last_success_at": value(max((connection.last_success_at for connection in connections if connection.last_success_at), default=None)),
        "stale_count": sum(not connection.last_success_at or now - connection.last_success_at.replace(tzinfo=connection.last_success_at.tzinfo or timezone.utc) > stale_after for connection in connections),
        "error_count": sum(connection.status in {"error", "reconnect_required"} for connection in connections),
    }


async def list_accounts(account_type: str | None = None) -> list[dict]:
    """List active accounts and their current balances."""
    query = accessible_accounts().order_by(Connection.institution_name, Account.type, Account.name)
    if account_type:
        query = query.where(Account.type == account_type)
    async with SessionLocal() as db:
        rows = (await db.execute(query)).all()
    return [account_data(account, connection) for account, connection in rows]


async def list_credit_cards() -> list[dict]:
    """List active credit cards, balances, statement data, and due dates."""
    query = accessible_accounts().outerjoin(CreditCardLiability).where(Account.type == "credit").order_by(CreditCardLiability.next_payment_due_date.asc().nulls_last(), Account.id)
    async with SessionLocal() as db:
        rows = (await db.execute(query.add_columns(CreditCardLiability))).all()
    return [{
        **account_data(account, connection),
        "credit_limit": value(liability.credit_limit) if liability else None,
        "last_statement_balance": value(liability.last_statement_balance) if liability else None,
        "last_statement_date": value(liability.last_statement_date) if liability else None,
        "minimum_payment": value(liability.minimum_payment) if liability else None,
        "next_payment_due_date": value(liability.next_payment_due_date) if liability else None,
        "purchase_apr": value(liability.purchase_apr) if liability else None,
        "interest_charge": value(liability.interest_charge) if liability else None,
        "is_overdue": liability.is_overdue if liability else None,
        "provider_updated_at": value(liability.provider_updated_at) if liability else None,
    } for account, connection, liability in rows]


async def transaction_rows(account_id: int | None, start_date: date | None, end_date: date | None, search: str | None, limit: int) -> tuple[list[dict], bool]:
    if limit < 1 or limit > MAX_TRANSACTIONS:
        raise ValueError(f"limit must be between 1 and {MAX_TRANSACTIONS}")
    if start_date and end_date and start_date > end_date:
        raise ValueError("start_date must not be after end_date")
    query = select(Transaction, Account, Connection).join(Account, Transaction.account_id == Account.id).join(Connection, Account.connection_id == Connection.id).where(~Transaction.removed, Account.active, Connection.status != "disconnected")
    if account_id is not None:
        query = query.where(Account.id == account_id)
    if start_date:
        query = query.where(Transaction.date >= start_date)
    if end_date:
        query = query.where(Transaction.date <= end_date)
    if search:
        needle = f"%{search.lower()}%"
        query = query.where(or_(func.lower(Transaction.description).like(needle), func.lower(func.coalesce(Transaction.merchant_name, "")).like(needle)))
    async with SessionLocal() as db:
        rows = (await db.execute(query.order_by(Transaction.date.desc(), Transaction.id.desc()).limit(limit + 1))).all()
    return [transaction_data(transaction, account, connection) for transaction, account, connection in rows[:limit]], len(rows) > limit


async def list_transactions(account_id: int | None = None, start_date: date | None = None, end_date: date | None = None, search: str | None = None, limit: int = 50) -> dict:
    """List the newest matching transactions. Results are capped at 200."""
    transactions, truncated = await transaction_rows(account_id, start_date, end_date, search, limit)
    return {"transactions": transactions, "truncated": truncated}


async def get_transaction_statement(account_id: int, start_date: date, end_date: date) -> dict:
    """Get one active account's transactions for a date range; this is not a bank PDF."""
    if start_date > end_date:
        raise ValueError("start_date must not be after end_date")
    async with SessionLocal() as db:
        row = (await db.execute(accessible_accounts().where(Account.id == account_id))).one_or_none()
    if not row:
        raise ValueError("account not found")
    account, connection = row
    transactions, truncated = await transaction_rows(account_id, start_date, end_date, None, MAX_TRANSACTIONS)
    return {"account": account_data(account, connection), "start_date": value(start_date), "end_date": value(end_date), "transactions": transactions, "truncated": truncated}


def create_mcp_server() -> MCPServer:
    server = MCPServer("Fin Track", instructions="Read-only personal finance data. Money values are decimal strings.")
    tools = (get_financial_summary, list_accounts, list_credit_cards, list_transactions, get_transaction_statement)
    for tool, documentation in zip(tools, MCP_TOOL_DOCS, strict=True):
        server.tool(annotations=ToolAnnotations(title=documentation["title"], readOnlyHint=True, destructiveHint=False, openWorldHint=False))(tool)
    return server
