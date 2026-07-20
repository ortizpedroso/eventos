"""add pix_chave_salva to usuarios

Revision ID: 20260717_000035
Revises: 20260716_000034
Create Date: 2026-07-17
"""
from alembic import op
import sqlalchemy as sa

revision = "20260717_000035"
down_revision = "20260716_000034"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("usuarios", sa.Column("pix_chave_salva", sa.String(120), nullable=True))
    op.add_column("usuarios", sa.Column("pix_tipo_salvo", sa.String(20), nullable=True))


def downgrade() -> None:
    op.drop_column("usuarios", "pix_tipo_salvo")
    op.drop_column("usuarios", "pix_chave_salva")