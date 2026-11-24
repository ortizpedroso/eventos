"""usuarios — capa e favicon da vitrine do organizador."""

from alembic import op
import sqlalchemy as sa

revision = "20261125_000052"
down_revision = "20261124_000051"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("usuarios", sa.Column("brand_cover_url", sa.Text(), nullable=True))
    op.add_column("usuarios", sa.Column("brand_favicon_url", sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column("usuarios", "brand_favicon_url")
    op.drop_column("usuarios", "brand_cover_url")
