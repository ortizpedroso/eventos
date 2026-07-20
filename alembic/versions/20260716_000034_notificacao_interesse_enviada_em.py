"""Adiciona notificacao_interesse_enviada_em em eventos.

Revision ID: 20260716_000034
Revises: 20260626_000033
Create Date: 2026-07-16
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "20260716_000034"
down_revision = "20260626_000033"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "eventos",
        sa.Column("notificacao_interesse_enviada_em", sa.DateTime(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("eventos", "notificacao_interesse_enviada_em")
