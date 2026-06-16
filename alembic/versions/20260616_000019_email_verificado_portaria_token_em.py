"""Verificação de e-mail do usuário e data do token da portaria."""

from alembic import op
import sqlalchemy as sa

revision = "20260616_000019"
down_revision = "20260524_000018"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "usuarios",
        sa.Column("email_verificado", sa.Boolean(), nullable=False, server_default=sa.true()),
    )
    op.add_column("usuarios", sa.Column("email_verificacao_token", sa.String(length=64), nullable=True))
    op.add_column("usuarios", sa.Column("email_verificacao_expires", sa.DateTime(), nullable=True))
    op.create_index(
        "ix_usuarios_email_verificacao_token",
        "usuarios",
        ["email_verificacao_token"],
        unique=False,
    )

    # Contas sem senha (compra rápida) precisam confirmar e-mail.
    op.execute(
        """
        UPDATE usuarios
        SET email_verificado = false
        WHERE senha_hash IS NULL AND (auth_provider IS NULL OR auth_provider = 'email')
        """
    )

    op.add_column("eventos", sa.Column("checkin_token_em", sa.DateTime(), nullable=True))
    op.execute(
        """
        UPDATE eventos
        SET checkin_token_em = data_criacao
        WHERE checkin_token IS NOT NULL AND checkin_token != ''
        """
    )


def downgrade() -> None:
    op.drop_column("eventos", "checkin_token_em")
    op.drop_index("ix_usuarios_email_verificacao_token", table_name="usuarios")
    op.drop_column("usuarios", "email_verificacao_expires")
    op.drop_column("usuarios", "email_verificacao_token")
    op.drop_column("usuarios", "email_verificado")
