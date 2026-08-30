from datetime import date, datetime, timezone
from decimal import Decimal

from fastapi.testclient import TestClient
from pwdlib import PasswordHash
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from fintrack.core.config import Settings, get_settings
from fintrack.db.base import get_db
from fintrack.db.meta import Base
from fintrack.db.models import Account, Connection, SyncRun, Transaction
from fintrack.main import app
from fintrack.routers.api import fuzzy_transaction_match


def test_auth_csrf_and_cursor_pagination(tmp_path):
    engine = create_async_engine(f"sqlite+aiosqlite:///{tmp_path / 'api.db'}")
    Session = async_sessionmaker(engine, expire_on_commit=False)
    settings = Settings(app={"environment": "test"}, session_signing_key="test-secret-that-is-at-least-32-bytes", owner_password_hash=PasswordHash.recommended().hash("correct"))

    async def prepare():
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)

    async def override_db():
        async with Session() as db:
            yield db

    import asyncio
    asyncio.run(prepare())
    app.dependency_overrides[get_settings] = lambda: settings
    app.dependency_overrides[get_db] = override_db
    with TestClient(app) as client:
        assert client.get("/api/v1/accounts").status_code == 401
        assert client.post("/api/v1/auth/login", json={"password": "wrong"}).status_code == 401
        assert client.post("/api/v1/auth/login", json={"password": "correct"}).status_code == 204
        csrf = client.cookies["fintrack_csrf"]
        assert client.post("/api/v1/sync", json={}).status_code == 403
        assert client.post("/api/v1/sync", json={}, headers={"X-CSRF-Token": csrf}).status_code == 202
        assert client.get("/api/v1/dashboard-preferences").json() == {"account_grouping": "institution", "hide_balances": False}
        assert client.post("/api/v1/dashboard-preferences", json={"account_grouping": "account_type"}, headers={"X-CSRF-Token": csrf}).json()["account_grouping"] == "account_type"
        assert client.post("/api/v1/dashboard-preferences", json={"hide_balances": True}, headers={"X-CSRF-Token": csrf}).json()["hide_balances"] is True

        async def seed():
            async with Session() as db:
                connection = Connection(provider_item_id="item", institution_name="Test Bank")
                db.add(connection); await db.flush()
                account = Account(connection_id=connection.id, provider_account_id="account", name="Checking", type="depository", currency="USD", current_balance=Decimal("100.00"))
                db.add(account); await db.flush()
                disconnected = Connection(provider_item_id="old-item", institution_name="Old Bank", status="disconnected")
                db.add(disconnected); await db.flush()
                db.add(Account(connection_id=disconnected.id, provider_account_id="old-account", name="Old checking", type="depository", currency="USD", current_balance=Decimal("500.00")))
                for index in range(3):
                    db.add(Transaction(account_id=account.id, provider_transaction_id=f"txn-{index}", date=date(2026, 8, 29), amount=Decimal(index), currency="USD", description=f"Transaction {index}", provider_updated_at=datetime.now(timezone.utc)))
                db.add(SyncRun(connection_id=connection.id, trigger="manual", status="succeeded", started_at=datetime(2026, 8, 29, tzinfo=timezone.utc), finished_at=datetime(2026, 8, 29, tzinfo=timezone.utc), available_at=datetime(2026, 8, 29, tzinfo=timezone.utc)))
                await db.commit()
        asyncio.run(seed())
        first = client.get("/api/v1/transactions?limit=2").json()
        second = client.get(f"/api/v1/transactions?limit=2&cursor={first['next_cursor']}").json()
        assert [row["id"] for row in first["items"]] == [3, 2]
        assert [row["id"] for row in second["items"]] == [1]
        assert first["total"] == 3
        assert "authorized_date" in first["items"][0]
        assert len(client.get("/api/v1/accounts").json()) == 1
        assert client.get("/api/v1/summary").json()["net_position"] == "100.0000"
        analytics = client.get("/api/v1/analytics?range=1w")
        assert analytics.status_code == 200 and analytics.json()["range"] == "1w"
        custom_analytics = client.get("/api/v1/analytics?start=2026-08-28&end=2026-08-29")
        assert custom_analytics.status_code == 200 and custom_analytics.json()["range"] == "custom"
        assert client.get("/api/v1/analytics?range=custom").status_code == 422
        assert len(client.get("/api/v1/sync-runs?start=2026-08-29&end=2026-08-29").json()) == 1
    app.dependency_overrides.clear()


def test_fuzzy_transaction_search():
    assert fuzzy_transaction_match("unitedd", "United Airlines", None)
    assert not fuzzy_transaction_match("unitedd", "Coffee Shop", None)
