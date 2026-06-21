"""repasse_parcelamento no evento

Revision ID: 20260620_000026
Revises: 20260619_000025
"""

from alembic import op
import sqlalchemy as sa

revision = "20260620_000026"
down_revision = "20260619_000025"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "eventos",
        sa.Column(
            "repasse_parcelamento",
            sa.String(length=16),
            nullable=False,
            server_default="comprador",
        ),
    )


def downgrade() -> None:
    op.drop_column("eventos", "repasse_parcelamento")
