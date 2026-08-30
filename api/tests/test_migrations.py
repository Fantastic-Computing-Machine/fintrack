import os
import pytest
from cryptography.fernet import Fernet
from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine, inspect
from sqlalchemy import text

from fintrack.db.types import decrypt_token

from fintrack.core.config import get_settings


def test_fresh_sqlite_upgrade(tmp_path, monkeypatch):
    database = tmp_path / "migration.db"
    monkeypatch.setenv("DATABASE_URL", f"sqlite:///{database}")
    get_settings.cache_clear()
    command.upgrade(Config("alembic.ini"), "head")
    tables = set(inspect(create_engine(f"sqlite:///{database}")).get_table_names())
    assert {"connections", "accounts", "transactions", "credit_card_liabilities", "sync_runs", "webhook_events"} <= tables
    get_settings.cache_clear()


def test_fernet_tokens_are_migrated_to_aes(tmp_path, monkeypatch):
    database = tmp_path / "tokens.db"
    url = f"sqlite:///{database}"
    monkeypatch.setenv("DATABASE_URL", url)
    old_key = Fernet.generate_key()
    new_key = "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA="
    config = Config("alembic.ini")
    command.upgrade(config, "933a1a5d4478")
    encrypted = Fernet(old_key).encrypt(b"access-token").decode()
    engine = create_engine(url)
    with engine.begin() as connection:
        connection.execute(text("INSERT INTO connections (provider, provider_item_id, institution_name, encrypted_access_token, status) VALUES ('plaid','item','Bank',:token,'active')"), {"token": encrypted})
    monkeypatch.setenv("OLD_TOKEN_ENCRYPTION_KEY", old_key.decode())
    monkeypatch.setenv("PLAID_TOKEN_MASTER_KEY", new_key)
    command.upgrade(config, "head")
    with engine.connect() as connection:
        value = connection.execute(text("SELECT access_token FROM connections")).scalar_one()
    assert b"access-token" not in value and decrypt_token(value, new_key) == "access-token"


def test_wrong_fernet_key_leaves_old_token_unchanged(tmp_path, monkeypatch):
    database = tmp_path / "bad-token.db"
    url = f"sqlite:///{database}"
    monkeypatch.setenv("DATABASE_URL", url)
    good_key = Fernet.generate_key()
    config = Config("alembic.ini")
    command.upgrade(config, "933a1a5d4478")
    original = Fernet(good_key).encrypt(b"access-token").decode()
    engine = create_engine(url)
    with engine.begin() as connection:
        connection.execute(text("INSERT INTO connections (provider, provider_item_id, institution_name, encrypted_access_token, status) VALUES ('plaid','item','Bank',:token,'active')"), {"token": original})
    monkeypatch.setenv("OLD_TOKEN_ENCRYPTION_KEY", Fernet.generate_key().decode())
    monkeypatch.setenv("PLAID_TOKEN_MASTER_KEY", "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=")
    with pytest.raises(RuntimeError):
        command.upgrade(config, "head")
    with engine.connect() as connection:
        assert connection.execute(text("SELECT encrypted_access_token FROM connections")).scalar_one() == original


@pytest.mark.skipif(not os.getenv("TEST_POSTGRES_URL"), reason="PostgreSQL is only available in integration CI")
def test_postgres_upgrade(monkeypatch):
    url = os.environ["TEST_POSTGRES_URL"]
    monkeypatch.setenv("DATABASE_URL", url)
    get_settings.cache_clear()
    command.upgrade(Config("alembic.ini"), "head")
    assert "transactions" in inspect(create_engine(url)).get_table_names()
    get_settings.cache_clear()
