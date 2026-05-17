"""ingresso participante CPF e telefone

Revision ID: 20260513_000005
Revises: 20260512_000004
Create Date: 2026-05-13
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "20260513_000005"
down_revision = "20260512_000004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "ingressos",
        sa.Column("participante_cpf", sa.String(length=14), nullable=True),
    )
    op.add_column(
        "ingressos",
        sa.Column("participante_telefone", sa.String(length=20), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("ingressos", "participante_telefone")
    op.drop_column("ingressos", "participante_cpf")
