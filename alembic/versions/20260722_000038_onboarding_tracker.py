"""onboarding tracker: e-mail dedup conta + status assinatura

Revision ID: 20260722_000038
Revises: 20260721_000037
"""
from alembic import op
import sqlalchemy as sa

revision = "20260722_000038"
down_revision = "20260721_000037"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("usuarios", sa.Column("onboarding_conta_email_event", sa.String(32), nullable=True))
    op.add_column("usuarios", sa.Column("assinatura_tracker_status", sa.String(32), nullable=True))
    op.add_column("usuarios", sa.Column("assinatura_tracker_falha_motivos", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("usuarios", "assinatura_tracker_falha_motivos")
    op.drop_column("usuarios", "assinatura_tracker_status")
    op.drop_column("usuarios", "onboarding_conta_email_event")
