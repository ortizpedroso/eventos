"""Campos Asaas para pagamentos e split.

Revision ID: 20260617_000020
Revises: 20260616_000019
"""

from alembic import op
import sqlalchemy as sa

revision = "20260617_000020"
down_revision = "20260616_000019"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("usuarios", sa.Column("asaas_customer_id", sa.String(), nullable=True))
    op.add_column("usuarios", sa.Column("asaas_wallet_id", sa.String(), nullable=True))
    op.add_column("usuarios", sa.Column("asaas_account_id", sa.String(), nullable=True))
    op.add_column("eventos", sa.Column("asaas_wallet_id", sa.String(), nullable=True))
    op.add_column("ingressos", sa.Column("asaas_payment_id", sa.String(), nullable=True))
    op.create_index("ix_ingressos_asaas_payment_id", "ingressos", ["asaas_payment_id"])
    op.add_column("cancelamentos", sa.Column("asaas_refund_id", sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column("cancelamentos", "asaas_refund_id")
    op.drop_index("ix_ingressos_asaas_payment_id", table_name="ingressos")
    op.drop_column("ingressos", "asaas_payment_id")
    op.drop_column("eventos", "asaas_wallet_id")
    op.drop_column("usuarios", "asaas_account_id")
    op.drop_column("usuarios", "asaas_wallet_id")
    op.drop_column("usuarios", "asaas_customer_id")
