"""encrypt cpf_cnpj repasse (String -> Text para enc:v2)

Revision ID: 20260724_000042
Revises: 20260724_000041
"""
from alembic import op
import sqlalchemy as sa

revision = "20260724_000042"
down_revision = "20260724_000041"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("usuarios") as batch_op:
        batch_op.alter_column(
            "asaas_repasse_cpf_cnpj",
            type_=sa.Text(),
            existing_type=sa.String(14),
            nullable=True,
        )


def downgrade() -> None:
    with op.batch_alter_table("usuarios") as batch_op:
        batch_op.alter_column(
            "asaas_repasse_cpf_cnpj",
            type_=sa.String(14),
            existing_type=sa.Text(),
            nullable=True,
        )
