"""PDV presencial + assentos nomeados no lote (MVP).

Revision ID: 20260731_000048
Revises: 20260731_000047
Create Date: 2026-07-31
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "20260731_000048"
down_revision = "20260731_000047"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "evento_ingresso_lotes",
        sa.Column("assentos", sa.Text(), nullable=True),
    )
    op.add_column(
        "ingressos",
        sa.Column("assento", sa.String(length=40), nullable=True),
    )
    op.add_column(
        "ingressos",
        sa.Column("canal_venda", sa.String(length=20), nullable=False, server_default="online"),
    )
    op.add_column(
        "ingressos",
        sa.Column("forma_pagamento_pdv", sa.String(length=40), nullable=True),
    )
    op.create_index("ix_ingressos_lote_assento", "ingressos", ["lote_id", "assento"])


def downgrade() -> None:
    op.drop_index("ix_ingressos_lote_assento", table_name="ingressos")
    op.drop_column("ingressos", "forma_pagamento_pdv")
    op.drop_column("ingressos", "canal_venda")
    op.drop_column("ingressos", "assento")
    op.drop_column("evento_ingresso_lotes", "assentos")
