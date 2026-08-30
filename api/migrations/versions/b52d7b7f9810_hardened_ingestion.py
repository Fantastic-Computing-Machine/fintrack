"""hardened async ingestion and encrypted token queue

Revision ID: b52d7b7f9810
Revises: 933a1a5d4478
"""
from __future__ import annotations

import os
from datetime import datetime, timezone

import sqlalchemy as sa
from alembic import op
from cryptography.fernet import Fernet, InvalidToken
from dotenv import dotenv_values

from fintrack.db.types import decrypt_token, encrypt_token

revision = "b52d7b7f9810"
down_revision = "933a1a5d4478"
branch_labels = None
depends_on = None
_FILE_ENVIRONMENT = dotenv_values(".env")


def _secret(name: str) -> str:
    return os.environ.get(name) or str(_FILE_ENVIRONMENT.get(name) or "")


def _converted_tokens() -> list[tuple[int, bytes]]:
    rows = op.get_bind().execute(sa.text("SELECT id, encrypted_access_token FROM connections WHERE encrypted_access_token IS NOT NULL")).all()
    if not rows:
        return []
    old_key = _secret("OLD_TOKEN_ENCRYPTION_KEY")
    new_key = _secret("PLAID_TOKEN_MASTER_KEY")
    try:
        fernet = Fernet(old_key.encode())
        return [(row.id, encrypt_token(fernet.decrypt(row.encrypted_access_token.encode()).decode(), new_key)) for row in rows]
    except (ValueError, InvalidToken, UnicodeDecodeError) as exc:
        raise RuntimeError("Token migration keys are invalid or an existing token failed authentication") from exc


def upgrade() -> None:
    converted = _converted_tokens()
    op.add_column("connections", sa.Column("access_token", sa.LargeBinary(), nullable=True))
    for connection_id, value in converted:
        op.get_bind().execute(sa.text("UPDATE connections SET access_token = :value WHERE id = :id"), {"value": value, "id": connection_id})
    with op.batch_alter_table("connections") as batch:
        batch.drop_constraint("ck_connections_status", type_="check")
        batch.create_check_constraint("ck_connections_status", "status IN ('active','error','reconnect_required','disconnected')")
        batch.drop_column("encrypted_access_token")

    with op.batch_alter_table("transactions") as batch:
        batch.drop_constraint("uq_transactions_account_provider", type_="unique")
        batch.create_unique_constraint("uq_transactions_provider_id", ["provider_transaction_id"])

    op.add_column("sync_runs", sa.Column("attempt_count", sa.Integer(), nullable=False, server_default="0"))
    op.add_column("sync_runs", sa.Column("available_at", sa.DateTime(timezone=True), nullable=True))
    op.execute(sa.text("UPDATE sync_runs SET available_at = started_at"))
    with op.batch_alter_table("sync_runs") as batch:
        batch.alter_column("available_at", nullable=False)
        batch.drop_index("uq_sync_one_running")
        batch.drop_constraint("ck_sync_trigger", type_="check")
        batch.drop_constraint("ck_sync_status", type_="check")
        batch.create_check_constraint("ck_sync_trigger", "trigger IN ('initial','manual','scheduled','webhook')")
        batch.create_check_constraint("ck_sync_status", "status IN ('queued','running','retry_wait','succeeded','failed')")
        batch.create_index("uq_sync_one_active", ["connection_id"], unique=True, sqlite_where=sa.text("status IN ('queued','running','retry_wait')"), postgresql_where=sa.text("status IN ('queued','running','retry_wait')"))

    op.create_table(
        "webhook_events",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("body_sha256", sa.String(64), nullable=False, unique=True),
        sa.Column("provider_item_id", sa.String(128)),
        sa.Column("webhook_type", sa.String(50), nullable=False),
        sa.Column("webhook_code", sa.String(80), nullable=False),
        sa.Column("detail", sa.String(100)),
        sa.Column("status", sa.String(20), nullable=False),
        sa.Column("received_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("available_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("processed_at", sa.DateTime(timezone=True)),
        sa.Column("attempt_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("error", sa.String(500)),
        sa.CheckConstraint("status IN ('queued','processing','processed','ignored','retry_wait','failed')", name="ck_webhook_status"),
    )
    op.create_index("ix_webhook_ready", "webhook_events", ["status", "available_at", "id"])
    op.create_index("ix_webhook_item_received", "webhook_events", ["provider_item_id", sa.literal_column("received_at DESC")])


def downgrade() -> None:
    op.drop_index("ix_webhook_item_received", table_name="webhook_events")
    op.drop_index("ix_webhook_ready", table_name="webhook_events")
    op.drop_table("webhook_events")
    with op.batch_alter_table("sync_runs") as batch:
        batch.drop_index("uq_sync_one_active")
        batch.drop_constraint("ck_sync_trigger", type_="check")
        batch.drop_constraint("ck_sync_status", type_="check")
        batch.create_check_constraint("ck_sync_trigger", "trigger IN ('initial','manual','scheduled')")
        batch.create_check_constraint("ck_sync_status", "status IN ('running','succeeded','failed')")
        batch.create_index("uq_sync_one_running", ["connection_id"], unique=True, sqlite_where=sa.text("status = 'running'"), postgresql_where=sa.text("status = 'running'"))
        batch.drop_column("available_at")
        batch.drop_column("attempt_count")
    with op.batch_alter_table("transactions") as batch:
        batch.drop_constraint("uq_transactions_provider_id", type_="unique")
        batch.create_unique_constraint("uq_transactions_account_provider", ["account_id", "provider_transaction_id"])
    op.add_column("connections", sa.Column("encrypted_access_token", sa.Text()))
    rows = op.get_bind().execute(sa.text("SELECT id, access_token FROM connections WHERE access_token IS NOT NULL")).all()
    if rows:
        old_key = _secret("OLD_TOKEN_ENCRYPTION_KEY")
        new_key = _secret("PLAID_TOKEN_MASTER_KEY")
        try:
            fernet = Fernet(old_key.encode())
            converted = [(row.id, fernet.encrypt(decrypt_token(bytes(row.access_token), new_key).encode()).decode()) for row in rows]
        except (ValueError, InvalidToken) as exc:
            raise RuntimeError("Token downgrade keys are invalid") from exc
        for connection_id, value in converted:
            op.get_bind().execute(sa.text("UPDATE connections SET encrypted_access_token = :value WHERE id = :id"), {"value": value, "id": connection_id})
    with op.batch_alter_table("connections") as batch:
        batch.drop_constraint("ck_connections_status", type_="check")
        batch.create_check_constraint("ck_connections_status", "status IN ('active','error','disconnected')")
        batch.drop_column("access_token")
