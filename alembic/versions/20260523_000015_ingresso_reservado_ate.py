"""Reserva com timer: coluna reservado_ate no ingresso.

Revision ID: 20260523_000015
Revises: 20260523_000014
Create Date: 2026-05-23

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "20260523_000015"
down_revision: Union[str, None] = "20260523_000014"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "ingressos",
        sa.Column("reservado_ate", sa.DateTime(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("ingressos", "reservado_ate")
