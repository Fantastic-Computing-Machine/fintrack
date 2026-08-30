"""allow transactions without an authorization date

Revision ID: 6fa2cd192c73
Revises: b52d7b7f9810
"""
from alembic import op
import sqlalchemy as sa

revision = "6fa2cd192c73"
down_revision = "b52d7b7f9810"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("transactions") as batch:
        batch.alter_column("authorized_date", existing_type=sa.Date(), nullable=True)


def downgrade() -> None:
    with op.batch_alter_table("transactions") as batch:
        batch.alter_column("authorized_date", existing_type=sa.Date(), nullable=False)
