"""add daily debt balance snapshots

Revision ID: a3b4c5d6e7f8
Revises: f7a8b9c0d1e2
"""
from alembic import op
import sqlalchemy as sa

revision = "a3b4c5d6e7f8"
down_revision = "f7a8b9c0d1e2"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "account_balance_snapshots",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("account_id", sa.Integer(), nullable=False),
        sa.Column("observed_on", sa.Date(), nullable=False),
        sa.Column("account_type", sa.String(length=20), nullable=False),
        sa.Column("current_balance", sa.Numeric(precision=19, scale=4), nullable=False),
        sa.CheckConstraint("account_type IN ('credit','loan')", name="ck_account_snapshots_type"),
        sa.ForeignKeyConstraint(["account_id"], ["accounts.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("account_id", "observed_on", name="uq_account_snapshots_account_day"),
    )
    op.create_index("ix_account_snapshots_observed_on", "account_balance_snapshots", ["observed_on", "account_type"])


def downgrade() -> None:
    op.drop_index("ix_account_snapshots_observed_on", table_name="account_balance_snapshots")
    op.drop_table("account_balance_snapshots")
