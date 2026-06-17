"""rename stripe_events to webhook_events

Revision ID: 20260618_000022
Revises: 20260617_000021
Create Date: 2026-06-18
"""

from alembic import op

revision = "20260618_000022"
down_revision = "20260617_000021"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    insp = __import__("sqlalchemy").inspect(bind)
    if "stripe_events" in insp.get_table_names() and "webhook_events" not in insp.get_table_names():
        op.rename_table("stripe_events", "webhook_events")


def downgrade() -> None:
    bind = op.get_bind()
    insp = __import__("sqlalchemy").inspect(bind)
    if "webhook_events" in insp.get_table_names() and "stripe_events" not in insp.get_table_names():
        op.rename_table("webhook_events", "stripe_events")
