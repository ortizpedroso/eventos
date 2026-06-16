"""Asaas: chave subconta e preferência de antecipação do organizador.

Revision ID: 20260617_000021
Revises: 20260617_000020
"""

from alembic import op
import sqlalchemy as sa

revision = "20260617_000021"
down_revision = "20260617_000020"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("usuarios", sa.Column("asaas_subaccount_api_key", sa.String(), nullable=True))
    op.add_column(
        "usuarios",
        sa.Column("asaas_anticipacao_cartao", sa.Boolean(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("usuarios", "asaas_anticipacao_cartao")
    op.drop_column("usuarios", "asaas_subaccount_api_key")
