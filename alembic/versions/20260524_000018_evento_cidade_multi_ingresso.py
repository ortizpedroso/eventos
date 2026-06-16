"""Evento cidade, lembrete ingresso, PI não único (multi-quantidade).

Revision ID: 20260524_000018
Revises: 20260523_000017
"""

from alembic import op
import sqlalchemy as sa

revision = "20260524_000018"
down_revision = "20260523_000017"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("eventos", sa.Column("cidade", sa.String(length=120), nullable=True))
    op.create_index("ix_eventos_cidade", "eventos", ["cidade"], unique=False)

    op.add_column("ingressos", sa.Column("lembrete_enviado_em", sa.DateTime(), nullable=True))

    # Vários ingressos podem compartilhar o mesmo PaymentIntent (compra com quantidade).
    with op.batch_alter_table("ingressos") as batch_op:
        batch_op.drop_index("ix_ingressos_stripe_payment_intent_id")
        batch_op.create_index(
            "ix_ingressos_stripe_payment_intent_id",
            ["stripe_payment_intent_id"],
            unique=False,
        )


def downgrade() -> None:
    with op.batch_alter_table("ingressos") as batch_op:
        batch_op.drop_index("ix_ingressos_stripe_payment_intent_id")
        batch_op.create_index(
            "ix_ingressos_stripe_payment_intent_id",
            ["stripe_payment_intent_id"],
            unique=True,
        )

    op.drop_column("ingressos", "lembrete_enviado_em")
    op.drop_index("ix_eventos_cidade", table_name="eventos")
    op.drop_column("eventos", "cidade")
