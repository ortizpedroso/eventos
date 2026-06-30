"""20260622_000029 — idempotência pagamento assinatura."""

from alembic import op
import sqlalchemy as sa

revision = "20260622_000029"
down_revision = "20260622_000028"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("usuarios", sa.Column("assinatura_ultimo_payment_id", sa.String(length=64), nullable=True))


def downgrade() -> None:
    op.drop_column("usuarios", "assinatura_ultimo_payment_id")
