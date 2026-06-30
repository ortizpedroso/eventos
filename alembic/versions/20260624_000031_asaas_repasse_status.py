"""20260624_000031 — status de aprovação da conta de repasse Asaas."""

from alembic import op
import sqlalchemy as sa

revision = "20260624_000031"
down_revision = "20260623_000030"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("usuarios", sa.Column("asaas_repasse_status", sa.String(length=32), nullable=True))
    op.add_column("usuarios", sa.Column("asaas_repasse_status_em", sa.DateTime(), nullable=True))
    op.add_column("usuarios", sa.Column("asaas_repasse_detalhes", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("usuarios", "asaas_repasse_detalhes")
    op.drop_column("usuarios", "asaas_repasse_status_em")
    op.drop_column("usuarios", "asaas_repasse_status")
