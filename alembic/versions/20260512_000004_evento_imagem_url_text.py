"""imagem_url como Text para URLs longas e data URLs

Revision ID: 20260512_000004
Revises: 20260512_000003
Create Date: 2026-05-12
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "20260512_000004"
down_revision = "20260512_000003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("eventos") as batch:
        batch.alter_column(
            "imagem_url",
            existing_type=sa.String(),
            type_=sa.Text(),
            existing_nullable=True,
        )


def downgrade() -> None:
    with op.batch_alter_table("eventos") as batch:
        batch.alter_column(
            "imagem_url",
            existing_type=sa.Text(),
            type_=sa.String(),
            existing_nullable=True,
        )
