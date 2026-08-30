"""hide pending rows replaced by posted Plaid transactions

Revision ID: f7a8b9c0d1e2
Revises: e1c2b3a4d5f6
"""
from alembic import op
import sqlalchemy as sa

revision = "f7a8b9c0d1e2"
down_revision = "e1c2b3a4d5f6"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(sa.text("""
        UPDATE transactions
        SET removed = true
        WHERE pending = true
          AND removed = false
          AND EXISTS (
              SELECT 1
              FROM transactions AS posted
              WHERE posted.account_id = transactions.account_id
                AND posted.pending = false
                AND posted.removed = false
                AND posted.pending_provider_id = transactions.provider_transaction_id
          )
    """))


def downgrade() -> None:
    # ponytail: a downgrade cannot safely resurrect provider-replaced pending rows; a later sync remains authoritative.
    pass
