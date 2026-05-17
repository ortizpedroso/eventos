"""Fase B: limite CPF, tipo de lote, check-in.

Revision ID: 20260516_000007
Revises: 20260514_000006
Create Date: 2026-05-16

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "20260516_000007"
down_revision: Union[str, None] = "20260514_000006"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("eventos", sa.Column("limite_ingressos_por_cpf", sa.Integer(), nullable=True))
    op.add_column(
        "evento_ingresso_lotes",
        sa.Column("tipo", sa.String(length=20), nullable=False, server_default="inteira"),
    )
    op.add_column("ingressos", sa.Column("checkin_em", sa.DateTime(), nullable=True))
    op.add_column("ingressos", sa.Column("checkin_por_id", sa.String(), nullable=True))
    op.create_foreign_key(
        "fk_ingressos_checkin_por_id_usuarios",
        "ingressos",
        "usuarios",
        ["checkin_por_id"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    op.drop_constraint("fk_ingressos_checkin_por_id_usuarios", "ingressos", type_="foreignkey")
    op.drop_column("ingressos", "checkin_por_id")
    op.drop_column("ingressos", "checkin_em")
    op.drop_column("evento_ingresso_lotes", "tipo")
    op.drop_column("eventos", "limite_ingressos_por_cpf")
