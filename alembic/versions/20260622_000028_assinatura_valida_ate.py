"""20260622_000028 — validade da assinatura mensal do organizador."""

from alembic import op
import sqlalchemy as sa

revision = "20260622_000028"
down_revision = "20260621_000027"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("usuarios", sa.Column("assinatura_valida_ate", sa.DateTime(), nullable=True))


def downgrade() -> None:
    op.drop_column("usuarios", "assinatura_valida_ate")
