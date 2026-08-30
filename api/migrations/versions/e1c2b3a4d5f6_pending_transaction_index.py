"""index pending transaction reconciliation

Revision ID: e1c2b3a4d5f6
Revises: 6fa2cd192c73
"""
from alembic import op

revision = "e1c2b3a4d5f6"
down_revision = "6fa2cd192c73"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_index("ix_transactions_pending_provider_id", "transactions", ["pending_provider_id"])


def downgrade() -> None:
    op.drop_index("ix_transactions_pending_provider_id", table_name="transactions")
