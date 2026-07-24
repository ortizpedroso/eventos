"""platform_settings — branding white-label da plataforma

Revision ID: 20260724_000039
Revises: 20260722_000038
"""
from alembic import op
import sqlalchemy as sa

revision = "20260724_000039"
down_revision = "20260722_000038"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "platform_settings",
        sa.Column("id", sa.String(32), primary_key=True),
        sa.Column("site_name", sa.String(120), nullable=False, server_default="EventosBR"),
        sa.Column("site_tagline", sa.String(255), nullable=True),
        sa.Column("footer_description", sa.Text(), nullable=True),
        sa.Column("contact_email", sa.String(255), nullable=True),
        sa.Column("support_email", sa.String(255), nullable=True),
        sa.Column("logo_url", sa.Text(), nullable=True),
        sa.Column("logo_light_url", sa.Text(), nullable=True),
        sa.Column("favicon_url", sa.Text(), nullable=True),
        sa.Column("primary_color", sa.String(7), nullable=False, server_default="#10b981"),
        sa.Column("primary_color_dark", sa.String(7), nullable=False, server_default="#047857"),
        sa.Column("social_instagram_url", sa.String(512), nullable=True),
        sa.Column("social_whatsapp_url", sa.String(512), nullable=True),
        sa.Column("social_linkedin_url", sa.String(512), nullable=True),
        sa.Column("social_x_url", sa.String(512), nullable=True),
        sa.Column("social_youtube_url", sa.String(512), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.execute(
        sa.text(
            "INSERT INTO platform_settings (id, site_name) VALUES ('default', 'EventosBR')"
        )
    )


def downgrade() -> None:
    op.drop_table("platform_settings")
