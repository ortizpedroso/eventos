"""OAuth Google/Apple — auth_provider e senha opcional.

Revision ID: 20260520_000011
Revises: 20260519_000010
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "20260520_000011"
down_revision: Union[str, None] = "20260519_000010"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "usuarios",
        sa.Column("auth_provider", sa.String(length=20), nullable=False, server_default="email"),
    )
    op.add_column(
        "usuarios",
        sa.Column("auth_provider_id", sa.String(length=255), nullable=True),
    )
    op.alter_column("usuarios", "senha_hash", existing_type=sa.String(), nullable=True)
    op.create_index(
        "ix_usuarios_auth_provider_id",
        "usuarios",
        ["auth_provider", "auth_provider_id"],
        unique=True,
    )


def downgrade() -> None:
    op.drop_index("ix_usuarios_auth_provider_id", table_name="usuarios")
    op.alter_column("usuarios", "senha_hash", existing_type=sa.String(), nullable=False)
    op.drop_column("usuarios", "auth_provider_id")
    op.drop_column("usuarios", "auth_provider")
