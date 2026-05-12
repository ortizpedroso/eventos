"""init

Revision ID: 20260511_000001
Revises: 
Create Date: 2026-05-11
"""

from __future__ import annotations

from alembic import op
import sqlalchemy as sa


revision = "20260511_000001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "usuarios",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("email", sa.String(), nullable=False),
        sa.Column("nome", sa.String(), nullable=False),
        sa.Column("senha_hash", sa.String(), nullable=False),
        sa.Column("tipo", sa.String(), nullable=False),
        sa.Column("stripe_customer_id", sa.String(), nullable=True),
        sa.Column("stripe_account_id", sa.String(), nullable=True),
        sa.Column("ativo", sa.Boolean(), nullable=True),
        sa.Column("data_criacao", sa.DateTime(), nullable=True),
        sa.Column("data_atualizacao", sa.DateTime(), nullable=True),
    )
    op.create_index("ix_usuarios_email", "usuarios", ["email"], unique=True)

    op.create_table(
        "eventos",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("slug", sa.String(), nullable=True),
        sa.Column("organizador_id", sa.String(), sa.ForeignKey("usuarios.id"), nullable=True),
        sa.Column("nome", sa.String(), nullable=True),
        sa.Column("descricao", sa.Text(), nullable=True),
        sa.Column("data_inicio", sa.DateTime(), nullable=True),
        sa.Column("local", sa.String(), nullable=True),
        sa.Column("imagem_url", sa.String(), nullable=True),
        sa.Column("stripe_account_id", sa.String(), nullable=True),
        sa.Column("publicado", sa.Boolean(), nullable=True),
        sa.Column("data_criacao", sa.DateTime(), nullable=True),
        sa.Column("data_atualizacao", sa.DateTime(), nullable=True),
    )
    op.create_index("ix_eventos_slug", "eventos", ["slug"], unique=True)
    op.create_index("ix_eventos_nome", "eventos", ["nome"], unique=False)

    op.create_table(
        "ingressos",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("evento_id", sa.String(), sa.ForeignKey("eventos.id"), nullable=True),
        sa.Column("usuario_id", sa.String(), sa.ForeignKey("usuarios.id"), nullable=True),
        sa.Column("stripe_payment_intent_id", sa.String(), nullable=True),
        sa.Column("valor", sa.Float(), nullable=True),
        sa.Column("status", sa.String(), nullable=True),
        sa.Column("data_compra", sa.DateTime(), nullable=True),
        sa.Column("data_limite_cancelamento", sa.DateTime(), nullable=True),
    )
    op.create_index("ix_ingressos_stripe_payment_intent_id", "ingressos", ["stripe_payment_intent_id"], unique=True)

    op.create_table(
        "cancelamentos",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("ingresso_id", sa.String(), sa.ForeignKey("ingressos.id"), nullable=False),
        sa.Column("valor_reembolso", sa.Float(), nullable=True),
        sa.Column("status", sa.String(), nullable=True),
        sa.Column("stripe_refund_id", sa.String(), nullable=True),
        sa.Column("data_solicitacao", sa.DateTime(), nullable=True),
        sa.Column("data_processamento", sa.DateTime(), nullable=True),
        sa.UniqueConstraint("ingresso_id", name="uq_cancelamentos_ingresso_id"),
    )

    op.create_table(
        "stripe_events",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("tipo", sa.String(), nullable=False),
        sa.Column("data_recebimento", sa.DateTime(), nullable=True),
    )


def downgrade() -> None:
    op.drop_table("stripe_events")
    op.drop_table("cancelamentos")
    op.drop_index("ix_ingressos_stripe_payment_intent_id", table_name="ingressos")
    op.drop_table("ingressos")
    op.drop_index("ix_eventos_nome", table_name="eventos")
    op.drop_index("ix_eventos_slug", table_name="eventos")
    op.drop_table("eventos")
    op.drop_index("ix_usuarios_email", table_name="usuarios")
    op.drop_table("usuarios")

