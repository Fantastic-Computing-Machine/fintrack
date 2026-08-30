import asyncio
from datetime import date, datetime, timezone
from decimal import Decimal

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from fintrack.core.config import Settings
from fintrack.db.meta import Base
from fintrack.db.models import Account, Connection, CreditCardLiability, Transaction
from fintrack.main import create_app
from fintrack import mcp_server


def test_mcp_settings_and_feature_gates():
    with pytest.raises(ValueError, match="MCP_AUTH_TOKEN"):
        Settings(app={"environment": "test"}, mcp_enable=True, mcp_auth_token="")

    for mcp_enabled in (False, True):
        for docs_enabled in (False, True):
            settings = Settings(app={"environment": "test"}, mcp_enable=mcp_enabled, docs_enable=docs_enabled, mcp_auth_token="test-token" if mcp_enabled else "")
            app = create_app(settings)
            with TestClient(app, base_url="http://localhost:8000") as client:
                assert client.get("/docs").status_code == (200 if docs_enabled else 404)
                if docs_enabled:
                    schema = client.get("/openapi.json").json()
                    assert schema["info"]["summary"] == "Private Plaid-backed finance dashboard"
                    assert schema["paths"]["/api/v1/transactions"]["get"]["summary"] == "Search and paginate transactions"
                    assert "APIKeyCookie" in schema["components"]["securitySchemes"]
                if mcp_enabled:
                    assert client.get("/mcp").status_code == 401
                    assert client.get("/mcp", headers={"Authorization": "Basic test-token"}).status_code == 401
                    assert client.get("/mcp", headers={"Authorization": "Bearer wrong"}).status_code == 401
                    assert client.post("/mcp", headers={"Authorization": "Bearer test-token"}).status_code == 400
                else:
                    assert client.get("/mcp").status_code == 404


def test_read_only_mcp_tools(tmp_path, monkeypatch):
    engine = create_async_engine(f"sqlite+aiosqlite:///{tmp_path / 'mcp.db'}")
    session = async_sessionmaker(engine, expire_on_commit=False)

    async def prepare():
        async with engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)
        async with session() as db:
            connection = Connection(provider_item_id="provider-item", institution_name="Test Bank")
            db.add(connection); await db.flush()
            checking = Account(connection_id=connection.id, provider_account_id="provider-checking", name="Checking", type="depository", currency="USD", current_balance=Decimal("100.00"))
            card = Account(connection_id=connection.id, provider_account_id="provider-card", name="Card", type="credit", currency="USD", current_balance=Decimal("25.00"))
            db.add_all([checking, card]); await db.flush()
            db.add(CreditCardLiability(account_id=card.id, last_statement_balance=Decimal("20.00"), minimum_payment=Decimal("5.00"), next_payment_due_date=date(2026, 9, 15), provider_updated_at=datetime.now(timezone.utc)))
            for index in range(201):
                db.add(Transaction(account_id=checking.id, provider_transaction_id=f"provider-{index}", date=date(2026, 8, 29), amount=Decimal("1.00"), currency="USD", description=f"Purchase {index}", provider_updated_at=datetime.now(timezone.utc)))
            await db.commit()
            return checking.id

    account_id = asyncio.run(prepare())
    monkeypatch.setattr(mcp_server, "SessionLocal", session)

    async def check():
        assert [tool.name for tool in await mcp_server.create_mcp_server().list_tools()] == ["get_financial_summary", "list_accounts", "list_credit_cards", "list_transactions", "get_transaction_statement"]
        assert (await mcp_server.get_financial_summary())["net_position"] == "75.0000"
        assert len(await mcp_server.list_accounts()) == 2
        cards = await mcp_server.list_credit_cards()
        assert cards[0]["next_payment_due_date"] == "2026-09-15"
        transactions = await mcp_server.list_transactions(account_id=account_id, search="purchase", limit=200)
        assert len(transactions["transactions"]) == 200 and transactions["truncated"]
        statement = await mcp_server.get_transaction_statement(account_id, date(2026, 8, 1), date(2026, 8, 31))
        assert statement["account"]["name"] == "Checking" and statement["truncated"]
        with pytest.raises(ValueError):
            await mcp_server.list_transactions(limit=201)
        with pytest.raises(ValueError):
            await mcp_server.get_transaction_statement(account_id, date(2026, 9, 1), date(2026, 8, 1))

    asyncio.run(check())
    asyncio.run(engine.dispose())
