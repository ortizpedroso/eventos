"""Versão de token JWT (invalidação ao desativar conta ou alterar senha).

Revision ID: 20260523_000014
Revises: 20260522_000013
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "20260523_000014"
down_revision: Union[str, None] = "20260522_000013"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "usuarios",
        sa.Column("token_version", sa.Integer(), nullable=False, server_default="0"),
    )
    op.alter_column("usuarios", "token_version", server_default=None)


def downgrade() -> None:
    op.drop_column("usuarios", "token_version")
