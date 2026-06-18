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
    is_pg = bind.dialect.name == "postgresql"

    # Repasse: wallet Asaas do organizador → eventos sem wallet configurada.
    if (
        _table_exists(insp, "eventos")
        and _table_exists(insp, "usuarios")
        and _column_exists(insp, "eventos", "asaas_wallet_id")
        and _column_exists(insp, "usuarios", "asaas_wallet_id")
    ):
        if is_pg:
            op.execute(
                """
                UPDATE eventos AS e
                SET asaas_wallet_id = u.asaas_wallet_id
                FROM usuarios AS u
                WHERE e.organizador_id = u.id
                  AND (e.asaas_wallet_id IS NULL OR e.asaas_wallet_id = '')
                  AND u.asaas_wallet_id IS NOT NULL
                  AND u.asaas_wallet_id != ''
                """
            )
        else:
            op.execute(
                """
                UPDATE eventos
                SET asaas_wallet_id = (
                    SELECT u.asaas_wallet_id
                    FROM usuarios AS u
                    WHERE u.id = eventos.organizador_id
                )
                WHERE (asaas_wallet_id IS NULL OR asaas_wallet_id = '')
                  AND EXISTS (
                    SELECT 1 FROM usuarios AS u
                    WHERE u.id = eventos.organizador_id
                      AND u.asaas_wallet_id IS NOT NULL
                      AND u.asaas_wallet_id != ''
                  )
                """
            )

    # Histórico de reembolsos: preservar IDs legados antes de dropar coluna Stripe.
    if (
        _table_exists(insp, "cancelamentos")
        and _column_exists(insp, "cancelamentos", "stripe_refund_id")
        and _column_exists(insp, "cancelamentos", "asaas_refund_id")
    ):
        op.execute(
            """
            UPDATE cancelamentos
            SET asaas_refund_id = stripe_refund_id
            WHERE (asaas_refund_id IS NULL OR asaas_refund_id = '')
              AND stripe_refund_id IS NOT NULL
              AND stripe_refund_id != ''
            """
        )

    if _table_exists(insp, "ingressos") and _column_exists(insp, "ingressos", "stripe_payment_intent_id"):
        # Preserva referência de auditoria em vendas já concluídas (não são IDs Asaas).
        if is_pg:
            op.execute(
                """
                UPDATE ingressos
                SET asaas_payment_id = 'legacy_stripe:' || stripe_payment_intent_id
                WHERE status IN ('pago', 'usado')
                  AND stripe_payment_intent_id IS NOT NULL
                  AND stripe_payment_intent_id != ''
                  AND (asaas_payment_id IS NULL OR asaas_payment_id = '')
                """
            )
        else:
            op.execute(
                """
                UPDATE ingressos
                SET asaas_payment_id = 'legacy_stripe:' || stripe_payment_intent_id
                WHERE status IN ('pago', 'usado')
                  AND stripe_payment_intent_id IS NOT NULL
                  AND stripe_payment_intent_id != ''
                  AND (asaas_payment_id IS NULL OR asaas_payment_id = '')
                """
            )

        # Pendentes com PI Stripe real: preservar ref para reconciliação manual (não cancelar às cegas).
        if is_pg:
            op.execute(
                """
                UPDATE ingressos
                SET asaas_payment_id = 'legacy_stripe:' || stripe_payment_intent_id
                WHERE status = 'pendente'
                  AND stripe_payment_intent_id IS NOT NULL
                  AND stripe_payment_intent_id != ''
                  AND stripe_payment_intent_id NOT LIKE 'disabled_%'
                  AND (asaas_payment_id IS NULL OR asaas_payment_id = '')
                """
            )
        else:
            op.execute(
                """
                UPDATE ingressos
                SET asaas_payment_id = 'legacy_stripe:' || stripe_payment_intent_id
                WHERE status = 'pendente'
                  AND stripe_payment_intent_id IS NOT NULL
                  AND stripe_payment_intent_id != ''
                  AND stripe_payment_intent_id NOT LIKE 'disabled_%'
                  AND (asaas_payment_id IS NULL OR asaas_payment_id = '')
                """
            )

        # Reservas de teste (disabled_*) sem Asaas — cancelar com segurança.
        op.execute(
            """
            UPDATE ingressos
            SET status = 'cancelado', reservado_ate = NULL
            WHERE status = 'pendente'
              AND stripe_payment_intent_id LIKE 'disabled_%'
              AND (asaas_payment_id IS NULL OR asaas_payment_id = '')
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

    if _table_exists(insp, "stripe_events") and _table_exists(insp, "webhook_events"):
        if is_pg:
            op.execute(
                """
                INSERT INTO webhook_events (id, tipo, data_recebimento)
                SELECT id, tipo, data_recebimento FROM stripe_events
                ON CONFLICT (id) DO NOTHING
                """
            )
        else:
            op.execute(
                """
                INSERT OR IGNORE INTO webhook_events (id, tipo, data_recebimento)
                SELECT id, tipo, data_recebimento FROM stripe_events
                """
            )
        op.drop_table("stripe_events")
    elif _table_exists(insp, "stripe_events") and not _table_exists(insp, "webhook_events"):
        op.rename_table("stripe_events", "webhook_events")


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
