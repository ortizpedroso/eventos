"""usuarios — cortesia de white-label concedida pelo dono da plataforma."""

from alembic import op
import sqlalchemy as sa

revision = "20261124_000051"
down_revision = "20261123_000050"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("usuarios", sa.Column("whitelabel_cortesia_ate", sa.DateTime(), nullable=True))


def downgrade() -> None:
    op.drop_column("usuarios", "whitelabel_cortesia_ate")
