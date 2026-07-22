"""add assinatura_renovacao_criado_em to usuarios

Revision ID: 20260721_000037
Revises: 20260721_000036
Create Date: 2026-07-21
"""
from alembic import op
import sqlalchemy as sa

revision = "20260721_000037"
down_revision = "20260721_000036"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("usuarios", sa.Column("assinatura_renovacao_criado_em", sa.DateTime(), nullable=True))


def downgrade() -> None:
    op.drop_column("usuarios", "assinatura_renovacao_criado_em")
