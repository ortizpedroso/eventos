"""contato do evento + telefone da plataforma

Revision ID: 20260725_000043
Revises: 20260724_000042
"""
from alembic import op
import sqlalchemy as sa

revision = "20260725_000043"
down_revision = "20260724_000042"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("eventos", sa.Column("contato_telefone", sa.String(20), nullable=True))
    op.add_column("eventos", sa.Column("contato_email", sa.String(255), nullable=True))
    op.add_column("platform_settings", sa.Column("contact_phone", sa.String(20), nullable=True))


def downgrade() -> None:
    op.drop_column("platform_settings", "contact_phone")
    op.drop_column("eventos", "contato_email")
    op.drop_column("eventos", "contato_telefone")
