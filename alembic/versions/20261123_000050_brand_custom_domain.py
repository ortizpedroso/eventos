"""usuarios — domínio próprio do organizador (white-label servido no host dele)."""

from alembic import op
import sqlalchemy as sa

revision = "20261123_000050"
down_revision = "20260802_000049"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("usuarios", sa.Column("brand_custom_domain", sa.String(253), nullable=True))
    op.add_column("usuarios", sa.Column("brand_custom_domain_ativo_em", sa.DateTime(), nullable=True))
    op.create_index(
        "ix_usuarios_brand_custom_domain", "usuarios", ["brand_custom_domain"], unique=True
    )


def downgrade() -> None:
    op.drop_index("ix_usuarios_brand_custom_domain", table_name="usuarios")
    op.drop_column("usuarios", "brand_custom_domain_ativo_em")
    op.drop_column("usuarios", "brand_custom_domain")
