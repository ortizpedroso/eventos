"""usuarios — tema (claro/escuro) e texto do rodapé da vitrine do organizador."""

from alembic import op
import sqlalchemy as sa

revision = "20261126_000053"
down_revision = "20261125_000052"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("usuarios", sa.Column("brand_tema_vitrine", sa.String(10), nullable=True))
    op.add_column("usuarios", sa.Column("brand_rodape_texto", sa.String(500), nullable=True))


def downgrade() -> None:
    op.drop_column("usuarios", "brand_rodape_texto")
    op.drop_column("usuarios", "brand_tema_vitrine")
