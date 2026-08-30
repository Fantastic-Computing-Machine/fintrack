"""add dashboard account grouping preference

Revision ID: c4d5e6f7a8b9
Revises: a3b4c5d6e7f8
"""

from alembic import op
import sqlalchemy as sa

revision = "c4d5e6f7a8b9"
down_revision = "a3b4c5d6e7f8"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "dashboard_preferences",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("account_grouping", sa.String(length=20), nullable=False, server_default="institution"),
        sa.CheckConstraint("id = 1", name="ck_dashboard_preferences_singleton"),
        sa.CheckConstraint("account_grouping IN ('institution','account_type')", name="ck_dashboard_preferences_account_grouping"),
        sa.PrimaryKeyConstraint("id"),
    )


def downgrade() -> None:
    op.drop_table("dashboard_preferences")
