"""liquido repassado por ingresso (ledger financeiro)

Revision ID: 20260621_000027
Revises: 20260620_000026
"""

from alembic import op
import sqlalchemy as sa

revision = "20260621_000027"
down_revision = "20260620_000026"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("ingressos", sa.Column("liquido_repassado", sa.Float(), nullable=True))
    op.add_column("ingressos", sa.Column("taxa_plataforma_aplicada", sa.Float(), nullable=True))
    op.add_column(
        "ingressos",
        sa.Column("desconto_parcelamento_organizador", sa.Float(), nullable=True),
    )
    op.add_column("ingressos", sa.Column("parcelas_cobranca", sa.Integer(), nullable=True))
    op.add_column("ingressos", sa.Column("plano_tarifa_venda", sa.String(length=16), nullable=True))
    op.add_column("ingressos", sa.Column("valor_cobrado", sa.Float(), nullable=True))


def downgrade() -> None:
    op.drop_column("ingressos", "valor_cobrado")
    op.drop_column("ingressos", "plano_tarifa_venda")
    op.drop_column("ingressos", "parcelas_cobranca")
    op.drop_column("ingressos", "desconto_parcelamento_organizador")
    op.drop_column("ingressos", "taxa_plataforma_aplicada")
    op.drop_column("ingressos", "liquido_repassado")
