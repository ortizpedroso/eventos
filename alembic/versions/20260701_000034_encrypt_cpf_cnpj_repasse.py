"""Ampliar asaas_repasse_cpf_cnpj para enc:v2 (coluna String → Text).

Revision ID: 20260701_000034
Revises: 20260626_000033
Create Date: 2026-07-01
"""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op


revision = "20260701_000034"
down_revision = "20260626_000033"
branch_labels = None
depends_on = None


def _table_exists(conn, table: str) -> bool:
    return table in sa.inspect(conn).get_table_names()


def _column_exists(conn, table: str, col: str) -> bool:
    if not _table_exists(conn, table):
        return False
    return any(c["name"] == col for c in sa.inspect(conn).get_columns(table))


def upgrade() -> None:
    conn = op.get_bind()
    if _column_exists(conn, "usuarios", "asaas_repasse_cpf_cnpj"):
        with op.batch_alter_table("usuarios") as batch_op:
            batch_op.alter_column(
                "asaas_repasse_cpf_cnpj",
                type_=sa.Text(),
                existing_type=sa.String(14),
                nullable=True,
            )


def downgrade() -> None:
    conn = op.get_bind()
    if _column_exists(conn, "usuarios", "asaas_repasse_cpf_cnpj"):
        with op.batch_alter_table("usuarios") as batch_op:
            batch_op.alter_column(
                "asaas_repasse_cpf_cnpj",
                type_=sa.String(14),
                existing_type=sa.Text(),
                nullable=True,
            )
