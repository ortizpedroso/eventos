"""platform_settings — Meta Pixel e GTM configuráveis no admin."""

from alembic import op
import sqlalchemy as sa

revision = "20260802_000049"
down_revision = "20260731_000048"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("platform_settings", sa.Column("meta_pixel_id", sa.String(32), nullable=True))
    op.add_column("platform_settings", sa.Column("gtm_id", sa.String(32), nullable=True))


def downgrade() -> None:
    op.drop_column("platform_settings", "gtm_id")
    op.drop_column("platform_settings", "meta_pixel_id")
