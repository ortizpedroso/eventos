"""20260623_000030 — ciclo de renovação e aviso de assinatura."""

from alembic import op
import sqlalchemy as sa

revision = "20260623_000030"
down_revision = "20260622_000029"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("usuarios", sa.Column("assinatura_aviso_expiracao_enviado_em", sa.DateTime(), nullable=True))
    op.add_column("usuarios", sa.Column("assinatura_renovacao_payment_id", sa.String(length=64), nullable=True))


def downgrade() -> None:
    op.drop_column("usuarios", "assinatura_renovacao_payment_id")
    op.drop_column("usuarios", "assinatura_aviso_expiracao_enviado_em")
