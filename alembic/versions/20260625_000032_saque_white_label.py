"""Ingresso pago_em e campos de saque Asaas (white-label).

Revision ID: 20260625_000032
Revises: 20260624_000031
Create Date: 2026-06-25
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "20260625_000032"
down_revision = "20260624_000031"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("ingressos", sa.Column("pago_em", sa.DateTime(), nullable=True))
    op.create_index("ix_ingressos_pago_em", "ingressos", ["pago_em"])

    op.add_column("financeiro_saques", sa.Column("asaas_transfer_id", sa.String(64), nullable=True))
    op.add_column("financeiro_saques", sa.Column("previsao_liquidacao_em", sa.DateTime(), nullable=True))
    op.add_column("financeiro_saques", sa.Column("processado_em", sa.DateTime(), nullable=True))
    op.create_index(
        "ix_financeiro_saques_asaas_transfer_id",
        "financeiro_saques",
        ["asaas_transfer_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_financeiro_saques_asaas_transfer_id", table_name="financeiro_saques")
    op.drop_column("financeiro_saques", "processado_em")
    op.drop_column("financeiro_saques", "previsao_liquidacao_em")
    op.drop_column("financeiro_saques", "asaas_transfer_id")
    op.drop_index("ix_ingressos_pago_em", table_name="ingressos")
    op.drop_column("ingressos", "pago_em")
