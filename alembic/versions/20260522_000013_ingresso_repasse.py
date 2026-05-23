"""Ingresso repasse: campos para transferência de titularidade do participante.

Revision ID: 20260522_000013
Revises: 20260522_000012
Create Date: 2026-05-22

"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "20260522_000013"
down_revision: Union[str, None] = "20260522_000012"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("ingressos", sa.Column("repassado_para_nome", sa.String(200), nullable=True))
    op.add_column("ingressos", sa.Column("repassado_para_cpf", sa.String(14), nullable=True))
    op.add_column("ingressos", sa.Column("repassado_para_email", sa.String(255), nullable=True))
    op.add_column("ingressos", sa.Column("repassado_para_telefone", sa.String(20), nullable=True))
    op.add_column("ingressos", sa.Column("repassado_para_data_nascimento", sa.String(10), nullable=True))
    op.add_column("ingressos", sa.Column("repassado_em", sa.DateTime(), nullable=True))


def downgrade() -> None:
    op.drop_column("ingressos", "repassado_em")
    op.drop_column("ingressos", "repassado_para_data_nascimento")
    op.drop_column("ingressos", "repassado_para_telefone")
    op.drop_column("ingressos", "repassado_para_email")
    op.drop_column("ingressos", "repassado_para_cpf")
    op.drop_column("ingressos", "repassado_para_nome")
