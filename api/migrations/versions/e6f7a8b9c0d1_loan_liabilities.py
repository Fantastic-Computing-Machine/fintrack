"""add loan repayment details

Revision ID: e6f7a8b9c0d1
Revises: d5e6f7a8b9c0
"""

from alembic import op
import sqlalchemy as sa

revision = "e6f7a8b9c0d1"
down_revision = "d5e6f7a8b9c0"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "loan_liabilities",
        sa.Column("account_id", sa.Integer(), nullable=False),
        sa.Column("next_payment_amount", sa.Numeric(precision=19, scale=4)),
        sa.Column("next_payment_due_date", sa.Date()),
        sa.Column("provider_updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(["account_id"], ["accounts.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("account_id"),
    )
    op.create_index("ix_loans_due_account", "loan_liabilities", ["next_payment_due_date", "account_id"])


def downgrade() -> None:
    op.drop_index("ix_loans_due_account", table_name="loan_liabilities")
    op.drop_table("loan_liabilities")
