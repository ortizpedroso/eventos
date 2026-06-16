"""Registro de aceite do termo de compra no ingresso.

Revision ID: 20260523_000016
Revises: 20260523_000015
Create Date: 2026-05-23

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "20260523_000016"
down_revision: Union[str, None] = "20260523_000015"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "ingressos",
        sa.Column("termo_compra_aceito_em", sa.DateTime(), nullable=True),
    )
    op.add_column(
        "ingressos",
        sa.Column("termo_compra_versao", sa.String(length=32), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("ingressos", "termo_compra_versao")
    op.drop_column("ingressos", "termo_compra_aceito_em")
