"""Token de link da portaria (check-in por colaboradores).

Revision ID: 20260522_000012
Revises: 20260520_000011
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "20260522_000012"
down_revision: Union[str, None] = "20260520_000011"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "eventos",
        sa.Column("checkin_token", sa.String(length=64), nullable=True),
    )
    op.create_index("ix_eventos_checkin_token", "eventos", ["checkin_token"], unique=True)


def downgrade() -> None:
    op.drop_index("ix_eventos_checkin_token", table_name="eventos")
    op.drop_column("eventos", "checkin_token")
