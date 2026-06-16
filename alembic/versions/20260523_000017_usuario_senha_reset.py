"""Recuperação de senha: token e expiração no usuário."""

from alembic import op
import sqlalchemy as sa

revision = "20260523_000017"
down_revision = "20260523_000016"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("usuarios", sa.Column("senha_reset_token", sa.String(length=64), nullable=True))
    op.add_column("usuarios", sa.Column("senha_reset_expires", sa.DateTime(), nullable=True))
    op.create_index("ix_usuarios_senha_reset_token", "usuarios", ["senha_reset_token"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_usuarios_senha_reset_token", table_name="usuarios")
    op.drop_column("usuarios", "senha_reset_expires")
    op.drop_column("usuarios", "senha_reset_token")
