"""usuarios — Meta Pixel e IDs do Google (GA4 e Ads) do organizador, usados na vitrine dele."""

from alembic import op
import sqlalchemy as sa

revision = "20261127_000054"
down_revision = "20261126_000053"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("usuarios", sa.Column("marketing_meta_pixel_id", sa.String(32), nullable=True))
    op.add_column("usuarios", sa.Column("marketing_ga4_id", sa.String(32), nullable=True))
    op.add_column("usuarios", sa.Column("marketing_google_ads_id", sa.String(32), nullable=True))
    op.add_column("usuarios", sa.Column("marketing_google_ads_label", sa.String(64), nullable=True))


def downgrade() -> None:
    op.drop_column("usuarios", "marketing_google_ads_label")
    op.drop_column("usuarios", "marketing_google_ads_id")
    op.drop_column("usuarios", "marketing_ga4_id")
    op.drop_column("usuarios", "marketing_meta_pixel_id")
