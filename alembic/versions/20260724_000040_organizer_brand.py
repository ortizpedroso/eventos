"""organizer brand white-label fields

Revision ID: 20260724_000040
Revises: 20260724_000039
"""
from alembic import op
import sqlalchemy as sa

revision = "20260724_000040"
down_revision = "20260724_000039"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("usuarios", sa.Column("brand_name", sa.String(120), nullable=True))
    op.add_column("usuarios", sa.Column("brand_logo_url", sa.Text(), nullable=True))
    op.add_column("usuarios", sa.Column("brand_primary_color", sa.String(7), nullable=True))
    op.add_column("usuarios", sa.Column("brand_primary_color_dark", sa.String(7), nullable=True))
    op.add_column("usuarios", sa.Column("brand_subdomain", sa.String(63), nullable=True))
    op.create_index("ix_usuarios_brand_subdomain", "usuarios", ["brand_subdomain"], unique=True)


def downgrade() -> None:
    op.drop_index("ix_usuarios_brand_subdomain", table_name="usuarios")
    op.drop_column("usuarios", "brand_subdomain")
    op.drop_column("usuarios", "brand_primary_color_dark")
    op.drop_column("usuarios", "brand_primary_color")
    op.drop_column("usuarios", "brand_logo_url")
    op.drop_column("usuarios", "brand_name")
