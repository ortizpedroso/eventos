"""Lançamento: CPF repasse, estorno em ingresso.

Revision ID: 20260626_000033
Revises: 20260625_000032
Create Date: 2026-06-26
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "20260626_000033"
down_revision = "20260625_000032"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("usuarios", sa.Column("asaas_repasse_cpf_cnpj", sa.String(14), nullable=True))
    op.add_column("ingressos", sa.Column("estornado_em", sa.DateTime(), nullable=True))
    op.create_index("ix_ingressos_estornado_em", "ingressos", ["estornado_em"])


def downgrade() -> None:
    op.drop_index("ix_ingressos_estornado_em", table_name="ingressos")
    op.drop_column("ingressos", "estornado_em")
    op.drop_column("usuarios", "asaas_repasse_cpf_cnpj")
