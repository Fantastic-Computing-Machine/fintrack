from datetime import datetime, timezone

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from fintrack.core.config import Settings
from fintrack.db.meta import Base
from fintrack.db.models import Connection, SyncRun, Transaction
from fintrack.services import sync


class FakePlaid:
    def __init__(self, _): pass
    async def balances(self, _):
        return {"accounts": [{"account_id": "account", "name": "Checking", "type": "depository", "subtype": "checking", "balances": {"current": 100, "available": 90, "iso_currency_code": "USD"}}]}
    async def transactions_sync(self, _, cursor):
        return {"added": [] if cursor else [{"account_id": "account", "transaction_id": "txn", "date": "2026-08-29", "amount": 10, "name": "Coffee", "iso_currency_code": "USD"}], "modified": [], "removed": [{"transaction_id": "txn"}] if cursor else [], "next_cursor": "next", "has_more": False}
    async def liabilities(self, _): return {"liabilities": {"credit": None}}


@pytest.mark.asyncio
async def test_sync_is_idempotent_and_applies_removals(tmp_path, monkeypatch):
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
        assert (await db.scalar(select(Transaction))).removed is False
        second = SyncRun(connection_id=connection_id, trigger="manual", status="running", started_at=now, available_at=now, attempt_count=1)
        db.add(second); await db.commit(); second_id = second.id
    await sync.sync_connection(connection_id, second_id, settings)
    async with Session() as db:
        rows = list((await db.scalars(select(Transaction))).all())
        assert len(rows) == 1 and rows[0].removed is True
    await engine.dispose()
