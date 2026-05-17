"""Fase C: cupons, cortesia responsável, cupom no ingresso.

Revision ID: 20260517_000008
Revises: 20260516_000007
Create Date: 2026-05-17

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "20260517_000008"
down_revision: Union[str, None] = "20260516_000007"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "evento_cupons",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("evento_id", sa.String(), nullable=False),
        sa.Column("codigo", sa.String(length=40), nullable=False),
        sa.Column("tipo", sa.String(length=12), nullable=False),
        sa.Column("valor", sa.Float(), nullable=False),
        sa.Column("max_usos", sa.Integer(), nullable=True),
        sa.Column("usos", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("ativo", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("valido_ate", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["evento_id"], ["eventos.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("evento_id", "codigo", name="uq_evento_cupom_codigo"),
    )
    op.create_index("ix_evento_cupons_evento_id", "evento_cupons", ["evento_id"])

    op.add_column("ingressos", sa.Column("cupom_id", sa.String(), nullable=True))
    op.add_column("ingressos", sa.Column("cortesia_responsavel", sa.String(length=200), nullable=True))
    op.create_foreign_key(
        "fk_ingressos_cupom_id_evento_cupons",
        "ingressos",
        "evento_cupons",
        ["cupom_id"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint("fk_ingressos_cupom_id_evento_cupons", "ingressos", type_="foreignkey")
    op.drop_column("ingressos", "cortesia_responsavel")
    op.drop_column("ingressos", "cupom_id")
    op.drop_index("ix_evento_cupons_evento_id", table_name="evento_cupons")
    op.drop_table("evento_cupons")
