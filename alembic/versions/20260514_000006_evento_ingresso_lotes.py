"""evento ingresso lotes

Revision ID: 20260514_000006
Revises: 20260513_000005
Create Date: 2026-05-14
"""

from __future__ import annotations

import uuid

import sqlalchemy as sa
from alembic import op


revision = "20260514_000006"
down_revision = "20260513_000005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    is_pg = bind.dialect.name == "postgresql"
    # PostgreSQL exige default booleano como true/false, não inteiro.
    ativo_default = sa.text("true") if is_pg else sa.text("1")

    op.create_table(
        "evento_ingresso_lotes",
        sa.Column("id", sa.String(), nullable=False),
        sa.Column("evento_id", sa.String(), nullable=False),
        sa.Column("nome", sa.String(length=120), nullable=False),
        sa.Column("preco", sa.Float(), nullable=False),
        sa.Column("ordem", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("quantidade_maxima", sa.Integer(), nullable=True),
        sa.Column("ativo", sa.Boolean(), nullable=False, server_default=ativo_default),
        sa.Column("vendas_inicio", sa.DateTime(), nullable=True),
        sa.Column("vendas_fim", sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(["evento_id"], ["eventos.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_evento_ingresso_lotes_evento_id",
        "evento_ingresso_lotes",
        ["evento_id"],
        unique=False,
    )

    op.add_column("ingressos", sa.Column("lote_id", sa.String(), nullable=True))
    op.create_index("ix_ingressos_lote_id", "ingressos", ["lote_id"], unique=False)
    op.create_foreign_key(
        "fk_ingressos_lote_id_evento_ingresso_lotes",
        "ingressos",
        "evento_ingresso_lotes",
        ["lote_id"],
        ["id"],
    )

    conn = bind
    insert_lote = (
        "INSERT INTO evento_ingresso_lotes "
        "(id, evento_id, nome, preco, ordem, quantidade_maxima, ativo, vendas_inicio, vendas_fim) "
        "VALUES (:id, :eid, :nome, :preco, 1, NULL, TRUE, NULL, NULL)"
        if is_pg
        else "INSERT INTO evento_ingresso_lotes "
        "(id, evento_id, nome, preco, ordem, quantidade_maxima, ativo, vendas_inicio, vendas_fim) "
        "VALUES (:id, :eid, :nome, :preco, 1, NULL, 1, NULL, NULL)"
    )
    rows = conn.execute(sa.text("SELECT id, preco_ingresso FROM eventos")).fetchall()
    for row in rows:
        eid = row[0]
        preco = float(row[1]) if row[1] is not None else 10.0
        lid = str(uuid.uuid4())
        conn.execute(
            sa.text(insert_lote),
            {"id": lid, "eid": eid, "nome": "Geral", "preco": preco},
        )
        conn.execute(
            sa.text("UPDATE ingressos SET lote_id = :lid WHERE evento_id = :eid AND (lote_id IS NULL OR lote_id = '')"),
            {"lid": lid, "eid": eid},
        )


def downgrade() -> None:
    op.drop_constraint("fk_ingressos_lote_id_evento_ingresso_lotes", "ingressos", type_="foreignkey")
    op.drop_index("ix_ingressos_lote_id", table_name="ingressos")
    op.drop_column("ingressos", "lote_id")
    op.drop_index("ix_evento_ingresso_lotes_evento_id", table_name="evento_ingresso_lotes")
    op.drop_table("evento_ingresso_lotes")
