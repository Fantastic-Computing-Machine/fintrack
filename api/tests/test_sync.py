from datetime import datetime, timezone

import pytest
from sqlalchemy import select
from sqlalchemy.exc import OperationalError
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from fintrack.core.config import Settings
from fintrack.db.meta import Base
from fintrack.db.models import AccountBalanceSnapshot, Connection, SyncRun, Transaction
from fintrack.services import sync


class FakePlaid:
    def __init__(self, _): pass
    async def balances(self, _):
        return {"accounts": [{"account_id": "account", "name": "Credit card", "type": "credit", "subtype": "credit card", "balances": {"current": 100, "available": 90, "iso_currency_code": "USD"}}]}
    async def transactions_sync(self, _, cursor):
        transaction = {"account_id": "account", "date": "2026-08-29", "amount": 10, "name": "Coffee", "iso_currency_code": "USD"}
        if not cursor:
            return {"added": [{**transaction, "transaction_id": "pending", "pending": True}], "modified": [], "removed": [], "next_cursor": "next", "has_more": False}
        return {"added": [{**transaction, "transaction_id": "posted", "pending_transaction_id": "pending", "pending": False}], "modified": [], "removed": [], "next_cursor": "next", "has_more": False}
    async def liabilities(self, _): return {"liabilities": {"credit": None}}


@pytest.mark.asyncio
async def test_sync_consolidates_pending_transactions(tmp_path, monkeypatch):
    engine = create_async_engine(f"sqlite+aiosqlite:///{tmp_path / 'sync.db'}")
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)
    Session = async_sessionmaker(engine, expire_on_commit=False)
    settings = Settings(app={"environment": "test"})
    now = datetime.now(timezone.utc)
    async with Session() as db:
        connection = Connection(provider_item_id="item", institution_name="Bank", access_token="token")
        db.add(connection); await db.flush()
        first = SyncRun(connection_id=connection.id, trigger="initial", status="running", started_at=now, available_at=now, attempt_count=1)
        db.add(first); await db.commit()
        connection_id, first_id = connection.id, first.id
    monkeypatch.setattr(sync, "SessionLocal", Session)
    monkeypatch.setattr(sync, "PlaidClient", FakePlaid)
    await sync.sync_connection(connection_id, first_id, settings)
    async with Session() as db:
        pending = await db.scalar(select(Transaction))
        assert pending.pending is True and pending.removed is False
        assert len((await db.scalars(select(AccountBalanceSnapshot))).all()) == 1
        second = SyncRun(connection_id=connection_id, trigger="manual", status="running", started_at=now, available_at=now, attempt_count=1)
        db.add(second); await db.commit(); second_id = second.id
    await sync.sync_connection(connection_id, second_id, settings)
    async with Session() as db:
        rows = {row.provider_transaction_id: row for row in (await db.scalars(select(Transaction))).all()}
        assert rows["pending"].removed is True
        assert rows["posted"].removed is False
        assert len((await db.scalars(select(AccountBalanceSnapshot))).all()) == 1
    await engine.dispose()


@pytest.mark.asyncio
async def test_database_contention_retries_without_marking_connection_error(tmp_path, monkeypatch):
    engine = create_async_engine(f"sqlite+aiosqlite:///{tmp_path / 'retry.db'}")
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)
    Session = async_sessionmaker(engine, expire_on_commit=False)
    now = datetime.now(timezone.utc)
    async with Session() as db:
        connection = Connection(provider_item_id="item", institution_name="Bank", access_token="token")
        db.add(connection); await db.flush()
        run = SyncRun(connection_id=connection.id, trigger="manual", status="running", started_at=now, available_at=now, attempt_count=1)
        db.add(run); await db.commit()
        connection_id, run_id = connection.id, run.id

    async def locked(*_):
        raise OperationalError("update", {}, Exception("database is locked"))

    monkeypatch.setattr(sync, "SessionLocal", Session)
    monkeypatch.setattr(sync, "PlaidClient", FakePlaid)
    monkeypatch.setattr(sync, "_apply_sync", locked)
    await sync.sync_connection(connection_id, run_id, Settings(app={"environment": "test"}))
    async with Session() as db:
        run = await db.get(SyncRun, run_id)
        connection = await db.get(Connection, connection_id)
        assert run.status == "retry_wait"
        assert run.error == "Database operation failed"
        assert connection.status == "active"
        assert connection.last_error is None
    await engine.dispose()
