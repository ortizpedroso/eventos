"""is_platform_admin no usuario

Revision ID: 20260725_000044
Revises: 20260725_000043
"""
from alembic import op
import sqlalchemy as sa

revision = "20260725_000044"
down_revision = "20260725_000043"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "usuarios",
        sa.Column("is_platform_admin", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.alter_column("usuarios", "is_platform_admin", server_default=None)


def downgrade() -> None:
    op.drop_column("usuarios", "is_platform_admin")
