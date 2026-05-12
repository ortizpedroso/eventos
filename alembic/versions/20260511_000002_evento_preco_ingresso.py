"""evento preco ingresso

Revision ID: 20260511_000002
Revises: 20260511_000001
Create Date: 2026-05-11
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "20260511_000002"
down_revision = "20260511_000001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "eventos",
        sa.Column("preco_ingresso", sa.Float(), nullable=False, server_default="10"),
    )


def downgrade() -> None:
    op.drop_column("eventos", "preco_ingresso")
