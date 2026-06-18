"""Cifra asaas_subaccount_api_key em repouso.

Revision ID: 20260618_000024
Revises: 20260618_000023
"""

from alembic import op
import sqlalchemy as sa

revision = "20260618_000024"
down_revision = "20260618_000023"
branch_labels = None
depends_on = None


def upgrade() -> None:
    from app.utils.secret_storage import encrypt_at_rest, is_encrypted_at_rest

    bind = op.get_bind()
    rows = bind.execute(
        sa.text(
            """
            SELECT id, asaas_subaccount_api_key
            FROM usuarios
            WHERE asaas_subaccount_api_key IS NOT NULL
              AND asaas_subaccount_api_key != ''
            """
        )
    ).fetchall()

    for row in rows:
        user_id, api_key = row[0], row[1]
        if not api_key or is_encrypted_at_rest(api_key):
            continue
        bind.execute(
            sa.text(
                "UPDATE usuarios SET asaas_subaccount_api_key = :enc WHERE id = :id"
            ),
            {"enc": encrypt_at_rest(api_key), "id": user_id},
        )


def downgrade() -> None:
    from app.utils.secret_storage import decrypt_at_rest, is_encrypted_at_rest

    bind = op.get_bind()
    rows = bind.execute(
        sa.text(
            """
            SELECT id, asaas_subaccount_api_key
            FROM usuarios
            WHERE asaas_subaccount_api_key IS NOT NULL
              AND asaas_subaccount_api_key != ''
            """
        )
    ).fetchall()

    for row in rows:
        user_id, stored = row[0], row[1]
        if not stored or not is_encrypted_at_rest(stored):
            continue
        plain = decrypt_at_rest(stored)
        if not plain:
            continue
        bind.execute(
            sa.text(
                "UPDATE usuarios SET asaas_subaccount_api_key = :plain WHERE id = :id"
            ),
            {"plain": plain, "id": user_id},
        )
