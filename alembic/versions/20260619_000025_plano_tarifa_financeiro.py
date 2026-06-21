"""plano_tarifa organizador + solicitações de saque

Revision ID: 20260619_000025
Revises: 20260618_000024
"""

from alembic import op
import sqlalchemy as sa

revision = "20260619_000025"
down_revision = "20260618_000024"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "usuarios",
        sa.Column("plano_tarifa", sa.String(length=16), nullable=False, server_default="padrao"),
    )
    op.create_table(
        "financeiro_saques",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("organizador_id", sa.String(), sa.ForeignKey("usuarios.id"), nullable=False, index=True),
        sa.Column("valor", sa.Numeric(12, 2), nullable=False),
        sa.Column("pix_chave", sa.String(length=120), nullable=False),
        sa.Column("pix_tipo", sa.String(length=20), nullable=False, server_default="EVP"),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="pendente"),
        sa.Column("observacao", sa.Text(), nullable=True),
        sa.Column("criado_em", sa.DateTime(), nullable=False),
        sa.Column("atualizado_em", sa.DateTime(), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("financeiro_saques")
    op.drop_column("usuarios", "plano_tarifa")
