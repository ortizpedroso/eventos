"""Consentimento para comunicações de marketing (email / WhatsApp).

Revision ID: 20260518_000009
Revises: 20260517_000008
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "20260518_000009"
down_revision: Union[str, None] = "20260517_000008"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "usuarios",
        sa.Column("aceita_comunicacao_email", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.add_column(
        "usuarios",
        sa.Column("aceita_comunicacao_whatsapp", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.add_column("usuarios", sa.Column("telefone", sa.String(length=20), nullable=True))
    op.add_column("usuarios", sa.Column("comunicacao_consentimento_em", sa.DateTime(), nullable=True))


def downgrade() -> None:
    op.drop_column("usuarios", "comunicacao_consentimento_em")
    op.drop_column("usuarios", "telefone")
    op.drop_column("usuarios", "aceita_comunicacao_whatsapp")
    op.drop_column("usuarios", "aceita_comunicacao_email")
