from __future__ import annotations

import random
from datetime import date, datetime, timedelta, timezone
from typing import Any
from zoneinfo import ZoneInfo

from sqlalchemy import select, update
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.dialects.sqlite import insert as sqlite_insert
from sqlalchemy.exc import IntegrityError, OperationalError
from sqlalchemy.ext.asyncio import AsyncSession

from ..core.config import Settings, get_settings
from ..db.base import SessionLocal
from ..db.models import Account, AccountBalanceSnapshot, Connection, CreditCardLiability, SyncRun, Transaction, WebhookEvent
from ..integrations.plaid import PlaidClient, PlaidError


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def as_date(value: str | date | None) -> date | None:
    return date.fromisoformat(value) if isinstance(value, str) else value


def as_datetime(value: str | datetime | None) -> datetime | None:
    return datetime.fromisoformat(value.replace("Z", "+00:00")) if isinstance(value, str) else value


def clean_error(exc: Exception) -> str:
    if isinstance(exc, PlaidError):
        return f"Plaid {exc.endpoint or 'request'}: {exc.code}"[:500]
    if isinstance(exc, OperationalError):
        return "Database operation failed"
    if isinstance(exc, TypeError):
        return f"TypeError: {exc}"[:500]
    return f"{type(exc).__name__}: provider operation failed"[:500]


def _insert(db: AsyncSession, model):
    return (sqlite_insert if db.bind and db.bind.dialect.name == "sqlite" else pg_insert)(model)


async def enqueue_sync(db: AsyncSession, connection_id: int, trigger: str) -> SyncRun | None:
    run = SyncRun(
        connection_id=connection_id,
        trigger=trigger,
        status="queued",
        started_at=utcnow(),
        available_at=utcnow(),
    )
    db.add(run)
    try:
        await db.commit()
        await db.refresh(run)
        return run
    except IntegrityError:
        await db.rollback()
        return None


async def _fetch_all(client: PlaidClient, token: str, cursor: str | None) -> tuple[list[dict[str, Any]], str | None]:
    original = cursor
    for restart in range(3):
        pages: list[dict[str, Any]] = []
        cursor = original
        try:
            while True:
                page = await client.transactions_sync(token, cursor)
                pages.append(page)
                cursor = page["next_cursor"]
                if not page.get("has_more"):
                    return pages, cursor
        except PlaidError as exc:
            if exc.code != "TRANSACTIONS_SYNC_MUTATION_DURING_PAGINATION" or restart == 2:
                raise
    raise PlaidError("TRANSACTIONS_SYNC_MUTATION_DURING_PAGINATION")


async def _apply_sync(
    db: AsyncSession,
    connection_id: int,
    run_id: int,
    starting_cursor: str | None,
    final_cursor: str | None,
    balances: list[dict[str, Any]],
    liabilities: list[dict[str, Any]],
    pages: list[dict[str, Any]],
    timezone_name: str,
) -> None:
    now = utcnow()
    observed_on = now.astimezone(ZoneInfo(timezone_name)).date()
    async with db.begin():
        connection = await db.scalar(select(Connection).where(Connection.id == connection_id).with_for_update())
        run = await db.get(SyncRun, run_id)
        if not connection or not run or connection.sync_cursor != starting_cursor:
            raise RuntimeError("Sync cursor changed while provider data was fetched")

        await db.execute(update(Account).where(Account.connection_id == connection_id).values(active=False))
        for raw in balances:
            values = {
                "connection_id": connection_id,
                "provider_account_id": raw["account_id"],
                "name": raw["name"],
                "official_name": raw.get("official_name"),
                "mask": raw.get("mask"),
                "type": raw["type"],
                "subtype": raw.get("subtype"),
                "currency": raw.get("balances", {}).get("iso_currency_code") or "USD",
                "current_balance": raw.get("balances", {}).get("current"),
                "available_balance": raw.get("balances", {}).get("available"),
                "active": True,
                "balance_at": as_datetime(raw.get("balances", {}).get("last_updated_datetime")) or now,
            }
            statement = _insert(db, Account).values(**values)
            updates = {key: value for key, value in values.items() if key not in {"connection_id", "provider_account_id"}}
            statement = statement.on_conflict_do_update(constraint="uq_accounts_connection_provider", set_=updates) if db.bind and db.bind.dialect.name == "postgresql" else statement.on_conflict_do_update(index_elements=["connection_id", "provider_account_id"], set_=updates)
            await db.execute(statement)

        accounts = (await db.execute(select(Account.provider_account_id, Account.id).where(Account.connection_id == connection_id))).all()
        account_ids = dict(accounts)
        debt_accounts = (await db.execute(select(Account.id, Account.type, Account.current_balance).where(Account.connection_id == connection_id, Account.active, Account.type.in_(("credit", "loan")), Account.current_balance.is_not(None)))).all()
        for account_id, account_type, current_balance in debt_accounts:
            values = {"account_id": account_id, "observed_on": observed_on, "account_type": account_type, "current_balance": current_balance}
            statement = _insert(db, AccountBalanceSnapshot).values(**values)
            statement = statement.on_conflict_do_update(constraint="uq_account_snapshots_account_day", set_={"account_type": account_type, "current_balance": current_balance}) if db.bind and db.bind.dialect.name == "postgresql" else statement.on_conflict_do_update(index_elements=["account_id", "observed_on"], set_={"account_type": account_type, "current_balance": current_balance})
            await db.execute(statement)
        added = modified = removed = 0
        pending_replacements: list[tuple[int, str]] = []
        for page in pages:
            added += len(page.get("added", []))
            modified += len(page.get("modified", []))
            removed_ids = [item["transaction_id"] for item in page.get("removed", [])]
            removed += len(removed_ids)
            if removed_ids:
                await db.execute(update(Transaction).where(Transaction.provider_transaction_id.in_(removed_ids)).values(removed=True, provider_updated_at=now))
            for raw in [*page.get("added", []), *page.get("modified", [])]:
                account_id = account_ids.get(raw["account_id"])
                if not account_id:
                    continue
                category = raw.get("personal_finance_category") or {}
                values = {
                    "account_id": account_id,
                    "provider_transaction_id": raw["transaction_id"],
                    "pending_provider_id": raw.get("pending_transaction_id"),
                    "date": as_date(raw["date"]),
                    "authorized_date": as_date(raw.get("authorized_date")),
                    "amount": raw["amount"],
                    "currency": raw.get("iso_currency_code") or "USD",
                    "merchant_name": raw.get("merchant_name"),
                    "description": raw.get("name") or "Transaction",
                    "category": category.get("detailed") or category.get("primary"),
                    "pending": raw.get("pending", False),
                    "removed": False,
                    "provider_updated_at": now,
                }
                statement = _insert(db, Transaction).values(**values)
                updates = {key: value for key, value in values.items() if key != "provider_transaction_id"}
                statement = statement.on_conflict_do_update(constraint="uq_transactions_provider_id", set_=updates) if db.bind and db.bind.dialect.name == "postgresql" else statement.on_conflict_do_update(index_elements=["provider_transaction_id"], set_=updates)
                await db.execute(statement)
                if not values["pending"] and values["pending_provider_id"] and values["pending_provider_id"] != values["provider_transaction_id"]:
                    pending_replacements.append((account_id, values["pending_provider_id"]))

        for account_id, pending_id in pending_replacements:
            await db.execute(update(Transaction).where(
                Transaction.account_id == account_id,
                Transaction.provider_transaction_id == pending_id,
                Transaction.pending,
                ~Transaction.removed,
            ).values(removed=True, provider_updated_at=now))

        for raw in liabilities:
            account_id = account_ids.get(raw["account_id"])
            if not account_id:
                continue
            purchase = next((apr for apr in raw.get("aprs", []) if apr.get("apr_type") == "purchase_apr"), None)
            values = {
                "account_id": account_id,
                "credit_limit": raw.get("credit_limit"),
                "last_statement_balance": raw.get("last_statement_balance"),
                "last_statement_date": as_date(raw.get("last_statement_issue_date")),
                "minimum_payment": raw.get("minimum_payment_amount"),
                "next_payment_due_date": as_date(raw.get("next_payment_due_date")),
                "purchase_apr": purchase.get("apr_percentage") if purchase else None,
                "interest_charge": raw.get("interest_charge_amount"),
                "is_overdue": raw.get("is_overdue"),
                "provider_updated_at": now,
            }
            statement = _insert(db, CreditCardLiability).values(**values).on_conflict_do_update(
                index_elements=["account_id"], set_={key: value for key, value in values.items() if key != "account_id"}
            )
            await db.execute(statement)

        connection.sync_cursor = final_cursor
        connection.status = "active"
        connection.last_success_at = now
        connection.last_attempt_at = now
        connection.last_error = None
        run.status = "succeeded"
        run.finished_at = now
        run.added_count = added
        run.modified_count = modified
        run.removed_count = removed
        run.error = None


async def sync_connection(connection_id: int, run_id: int, settings: Settings | None = None) -> None:
    settings = settings or get_settings()
    client = PlaidClient(settings)
    try:
        async with SessionLocal() as db:
            connection = await db.get(Connection, connection_id)
            if not connection or not connection.access_token:
                raise RuntimeError("Connection is unavailable")
            token = connection.access_token
            starting_cursor = connection.sync_cursor
        balance_data = await client.balances(token)
        pages, final_cursor = await _fetch_all(client, token, starting_cursor)
        try:
            liability_data = await client.liabilities(token)
            liabilities = (liability_data.get("liabilities") or {}).get("credit") or []
        except PlaidError as exc:
            if exc.code in {"PRODUCT_NOT_READY", "NO_LIABILITY_ACCOUNTS"}:
                liabilities = []
            else:
                raise
        async with SessionLocal() as db:
            await _apply_sync(db, connection_id, run_id, starting_cursor, final_cursor, balance_data.get("accounts") or [], liabilities, pages, settings.app.timezone)
    except Exception as exc:
        async with SessionLocal() as db:
            run = await db.get(SyncRun, run_id)
            if not run:
                return
            now = utcnow()
            retry_database = isinstance(exc, OperationalError)
            retry_rate_limit = isinstance(exc, PlaidError) and exc.code == "RATE_LIMIT_EXCEEDED"
            if (retry_database or retry_rate_limit) and run.attempt_count < settings.sync.max_attempts:
                delay = (exc.retry_after if retry_rate_limit else None) or min(3600, 5 * 2 ** max(0, run.attempt_count - 1)) + random.uniform(0, 3)
                run.status = "retry_wait"
                run.available_at = now + timedelta(seconds=delay)
            else:
                run.status = "failed"
                run.finished_at = now
            run.error = clean_error(exc)
            if retry_database:
                await db.execute(update(Connection).where(Connection.id == connection_id).values(last_attempt_at=now))
            else:
                await db.execute(update(Connection).where(Connection.id == connection_id).values(
                    last_attempt_at=now,
                    last_error=run.error,
                    status="reconnect_required" if isinstance(exc, PlaidError) and exc.code in {"ITEM_LOGIN_REQUIRED", "INVALID_ACCESS_TOKEN"} else "error",
                ))
            await db.commit()


async def claim_sync_run() -> tuple[int, int] | None:
    async with SessionLocal() as db:
        now = utcnow()
        query = select(SyncRun).where(SyncRun.status.in_(["queued", "retry_wait"]), SyncRun.available_at <= now).order_by(SyncRun.available_at, SyncRun.id).limit(1)
        if db.bind and db.bind.dialect.name == "postgresql":
            query = query.with_for_update(skip_locked=True)
        run = await db.scalar(query)
        if not run:
            return None
        await db.scalar(select(Connection).where(Connection.id == run.connection_id).with_for_update())
        run.status = "running"
        run.attempt_count += 1
        run.started_at = now
        await db.commit()
        return run.connection_id, run.id


async def drain_sync_runs() -> None:
    while claimed := await claim_sync_run():
        await sync_connection(*claimed)


async def enqueue_fallback_syncs() -> None:
    async with SessionLocal() as db:
        ids = list((await db.scalars(select(Connection.id).where(Connection.status != "disconnected", Connection.access_token.is_not(None)))).all())
    for connection_id in ids:
        async with SessionLocal() as db:
            await enqueue_sync(db, connection_id, "scheduled")


async def drain_webhook_events() -> None:
    while True:
        async with SessionLocal() as db:
            now = utcnow()
            query = select(WebhookEvent).where(WebhookEvent.status.in_(["queued", "retry_wait"]), WebhookEvent.available_at <= now).order_by(WebhookEvent.id).limit(1)
            if db.bind and db.bind.dialect.name == "postgresql":
                query = query.with_for_update(skip_locked=True)
            event = await db.scalar(query)
            if not event:
                return
            event.status = "processing"
            event.attempt_count += 1
            await db.commit()
            event_id = event.id
        try:
            async with SessionLocal() as db:
                event = await db.get(WebhookEvent, event_id)
                connection = await db.scalar(select(Connection).where(Connection.provider_item_id == event.provider_item_id)) if event and event.provider_item_id else None
                handled = False
                if event and connection and event.webhook_type == "TRANSACTIONS" and event.webhook_code == "SYNC_UPDATES_AVAILABLE":
                    handled = True
                    await enqueue_sync(db, connection.id, "webhook")
                    event = await db.get(WebhookEvent, event_id)
                elif event and connection and event.webhook_type == "ITEM" and event.webhook_code in {"ERROR", "PENDING_DISCONNECT", "PENDING_EXPIRATION"}:
                    handled = True
                    connection.status = "reconnect_required"
                    connection.last_error = "Plaid Item requires Link update mode"
                if event:
                    event.status = "processed" if handled else "ignored"
                    event.processed_at = utcnow()
                    await db.commit()
        except Exception as exc:
            async with SessionLocal() as db:
                event = await db.get(WebhookEvent, event_id)
                if event:
                    event.status = "failed"
                    event.error = clean_error(exc)
                    await db.commit()
