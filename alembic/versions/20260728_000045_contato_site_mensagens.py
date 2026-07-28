"""contato_site_mensagens

Revision ID: 20260728_000045
Revises: 20260725_000044
"""
from alembic import op
import sqlalchemy as sa

revision = "20260728_000045"
down_revision = "20260725_000044"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "contato_site_mensagens",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("nome", sa.String(length=200), nullable=False),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("assunto", sa.String(length=200), nullable=False),
        sa.Column("mensagem", sa.Text(), nullable=False),
        sa.Column("email_enviado", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("criado_em", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_contato_site_mensagens_criado_em",
        "contato_site_mensagens",
        ["criado_em"],
    )


def downgrade() -> None:
    op.drop_index("ix_contato_site_mensagens_criado_em", table_name="contato_site_mensagens")
    op.drop_table("contato_site_mensagens")
