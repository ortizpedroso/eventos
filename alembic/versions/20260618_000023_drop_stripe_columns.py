"""Remove colunas Stripe legadas — apenas Asaas.

Revision ID: 20260618_000023
Revises: 20260618_000022
"""

from alembic import op
import sqlalchemy as sa

revision = "20260618_000023"
down_revision = "20260618_000022"
branch_labels = None
depends_on = None


def _column_exists(insp, table: str, column: str) -> bool:
    return column in {c["name"] for c in insp.get_columns(table)}


def _index_exists(insp, table: str, index: str) -> bool:
    return index in {i["name"] for i in insp.get_indexes(table)}


def _table_exists(insp, table: str) -> bool:
    return table in insp.get_table_names()


def upgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)

    if _table_exists(insp, "ingressos") and _column_exists(insp, "ingressos", "stripe_payment_intent_id"):
        op.execute(
            """
            UPDATE ingressos
            SET asaas_payment_id = stripe_payment_intent_id
            WHERE (asaas_payment_id IS NULL OR asaas_payment_id = '')
              AND stripe_payment_intent_id IS NOT NULL
              AND stripe_payment_intent_id != ''
            """
        )
        if _index_exists(insp, "ingressos", "ix_ingressos_stripe_payment_intent_id"):
            op.drop_index("ix_ingressos_stripe_payment_intent_id", table_name="ingressos")
        op.drop_column("ingressos", "stripe_payment_intent_id")

    if _table_exists(insp, "usuarios"):
        if _column_exists(insp, "usuarios", "stripe_customer_id"):
            op.drop_column("usuarios", "stripe_customer_id")
        if _column_exists(insp, "usuarios", "stripe_account_id"):
            op.drop_column("usuarios", "stripe_account_id")

    if _table_exists(insp, "eventos") and _column_exists(insp, "eventos", "stripe_account_id"):
        op.drop_column("eventos", "stripe_account_id")

    if _table_exists(insp, "cancelamentos") and _column_exists(insp, "cancelamentos", "stripe_refund_id"):
        op.drop_column("cancelamentos", "stripe_refund_id")

    if _table_exists(insp, "stripe_events") and not _table_exists(insp, "webhook_events"):
        op.rename_table("stripe_events", "webhook_events")
    elif _table_exists(insp, "stripe_events"):
        op.drop_table("stripe_events")


def downgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)

    if _table_exists(insp, "usuarios") and not _column_exists(insp, "usuarios", "stripe_customer_id"):
        op.add_column("usuarios", sa.Column("stripe_customer_id", sa.String(), nullable=True))
        op.add_column("usuarios", sa.Column("stripe_account_id", sa.String(), nullable=True))

    if _table_exists(insp, "eventos") and not _column_exists(insp, "eventos", "stripe_account_id"):
        op.add_column("eventos", sa.Column("stripe_account_id", sa.String(), nullable=True))

    if _table_exists(insp, "ingressos") and not _column_exists(insp, "ingressos", "stripe_payment_intent_id"):
        op.add_column("ingressos", sa.Column("stripe_payment_intent_id", sa.String(), nullable=True))
        op.create_index(
            "ix_ingressos_stripe_payment_intent_id",
            "ingressos",
            ["stripe_payment_intent_id"],
            unique=True,
        )

    if _table_exists(insp, "cancelamentos") and not _column_exists(insp, "cancelamentos", "stripe_refund_id"):
        op.add_column("cancelamentos", sa.Column("stripe_refund_id", sa.String(), nullable=True))
