"""add asaas_payment_criado_em to ingressos

Revision ID: 20260721_000036
Revises: 20260717_000035
Create Date: 2026-07-21
"""
from alembic import op
import sqlalchemy as sa

revision = "20260721_000036"
down_revision = "20260717_000035"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("ingressos", sa.Column("asaas_payment_criado_em", sa.DateTime(), nullable=True))


def downgrade() -> None:
    op.drop_column("ingressos", "asaas_payment_criado_em")
