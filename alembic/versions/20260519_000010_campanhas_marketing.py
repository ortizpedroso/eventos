"""Campanhas de marketing da plataforma (painel admin).

Revision ID: 20260519_000010
Revises: 20260518_000009
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "20260519_000010"
down_revision: Union[str, None] = "20260518_000009"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "campanhas_marketing",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("nome", sa.String(length=200), nullable=False),
        sa.Column("assunto", sa.String(length=200), nullable=False),
        sa.Column("mensagem", sa.Text(), nullable=False),
        sa.Column("canal", sa.String(length=12), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="rascunho"),
        sa.Column("total_destinatarios", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("enviados_ok", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("enviados_erro", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("criado_em", sa.DateTime(), nullable=False),
        sa.Column("disparado_em", sa.DateTime(), nullable=True),
    )
    op.create_table(
        "campanha_envios",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("campanha_id", sa.String(), nullable=False),
        sa.Column("usuario_id", sa.String(), nullable=True),
        sa.Column("nome", sa.String(length=200), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=True),
        sa.Column("telefone", sa.String(length=20), nullable=True),
        sa.Column("canal_envio", sa.String(length=12), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="pendente"),
        sa.Column("erro_msg", sa.String(length=500), nullable=True),
        sa.Column("enviado_em", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["campanha_id"], ["campanhas_marketing.id"], ondelete="CASCADE"),
    )
    op.create_index("ix_campanha_envios_campanha_id", "campanha_envios", ["campanha_id"])


def downgrade() -> None:
    op.drop_index("ix_campanha_envios_campanha_id", table_name="campanha_envios")
    op.drop_table("campanha_envios")
    op.drop_table("campanhas_marketing")
