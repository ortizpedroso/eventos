"""organizador 2fa (totp)

Revision ID: 20260724_000041
Revises: 20260724_000040
"""
from alembic import op
import sqlalchemy as sa

revision = "20260724_000041"
down_revision = "20260724_000040"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("usuarios", sa.Column("totp_secret", sa.Text(), nullable=True))
    op.add_column("usuarios", sa.Column("totp_ativado", sa.Boolean(), nullable=False, server_default=sa.false()))
    op.add_column("usuarios", sa.Column("totp_ativado_em", sa.DateTime(), nullable=True))
    op.add_column("usuarios", sa.Column("totp_recovery_codes", sa.Text(), nullable=True))
    op.alter_column("usuarios", "totp_ativado", server_default=None)


def downgrade() -> None:
    op.drop_column("usuarios", "totp_recovery_codes")
    op.drop_column("usuarios", "totp_ativado_em")
    op.drop_column("usuarios", "totp_ativado")
    op.drop_column("usuarios", "totp_secret")
