"""persist overview balance privacy

Revision ID: d5e6f7a8b9c0
Revises: c4d5e6f7a8b9
"""

from alembic import op
import sqlalchemy as sa

revision = "d5e6f7a8b9c0"
down_revision = "c4d5e6f7a8b9"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("dashboard_preferences") as batch:
        batch.add_column(sa.Column("hide_balances", sa.Boolean(), nullable=False, server_default=sa.false()))


def downgrade() -> None:
    with op.batch_alter_table("dashboard_preferences") as batch:
        batch.drop_column("hide_balances")
