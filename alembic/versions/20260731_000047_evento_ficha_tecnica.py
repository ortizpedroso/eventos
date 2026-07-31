"""evento ficha tecnica (classificacao, o que levar, estacionamento)

Revision ID: 20260731_000047
Revises: 20260730_000046
"""
from alembic import op
import sqlalchemy as sa

revision = "20260731_000047"
down_revision = "20260730_000046"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("eventos", sa.Column("classificacao_etaria", sa.String(16), nullable=True))
    op.add_column("eventos", sa.Column("o_que_levar", sa.String(280), nullable=True))
    op.add_column("eventos", sa.Column("estacionamento", sa.String(280), nullable=True))


def downgrade() -> None:
    op.drop_column("eventos", "estacionamento")
    op.drop_column("eventos", "o_que_levar")
    op.drop_column("eventos", "classificacao_etaria")
