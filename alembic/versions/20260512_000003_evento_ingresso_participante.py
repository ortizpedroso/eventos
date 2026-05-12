"""evento data fim categoria mensagem; ingresso participante

Revision ID: 20260512_000003
Revises: 20260511_000002
Create Date: 2026-05-12
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "20260512_000003"
down_revision = "20260511_000002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("eventos", sa.Column("data_fim", sa.DateTime(), nullable=True))
    op.add_column(
        "eventos",
        sa.Column("categoria", sa.String(length=80), nullable=False, server_default="Outros"),
    )
    op.add_column(
        "eventos",
        sa.Column("mensagem_confirmacao", sa.Text(), nullable=True),
    )
    op.execute("UPDATE eventos SET data_fim = data_inicio WHERE data_fim IS NULL")
    op.alter_column("eventos", "data_fim", existing_type=sa.DateTime(), nullable=False)

    op.add_column(
        "ingressos",
        sa.Column("participante_nome", sa.String(length=200), nullable=True),
    )
    op.add_column(
        "ingressos",
        sa.Column("participante_email", sa.String(length=255), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("ingressos", "participante_email")
    op.drop_column("ingressos", "participante_nome")
    op.drop_column("eventos", "mensagem_confirmacao")
    op.drop_column("eventos", "categoria")
    op.drop_column("eventos", "data_fim")
