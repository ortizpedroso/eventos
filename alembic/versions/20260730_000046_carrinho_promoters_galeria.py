"""carrinho lembrete + promoters + galeria

Revision ID: 20260730_000046
Revises: 20260728_000045
"""
from alembic import op
import sqlalchemy as sa

revision = "20260730_000046"
down_revision = "20260728_000045"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "ingressos",
        sa.Column("carrinho_lembrete_enviado_em", sa.DateTime(), nullable=True),
    )
    op.create_index(
        "ix_ingressos_carrinho_lembrete_enviado_em",
        "ingressos",
        ["carrinho_lembrete_enviado_em"],
    )

    op.create_table(
        "evento_promoters",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("evento_id", sa.String(), nullable=False),
        sa.Column("organizador_id", sa.String(), nullable=False),
        sa.Column("codigo", sa.String(length=32), nullable=False),
        sa.Column("rotulo", sa.String(length=120), nullable=True),
        sa.Column("ativo", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("criado_em", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["evento_id"], ["eventos.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["organizador_id"], ["usuarios.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("evento_id", "codigo", name="uq_evento_promoter_codigo"),
    )
    op.create_index("ix_evento_promoters_evento_id", "evento_promoters", ["evento_id"])
    op.create_index("ix_evento_promoters_organizador_id", "evento_promoters", ["organizador_id"])

    op.add_column(
        "ingressos",
        sa.Column("promoter_id", sa.String(), nullable=True),
    )
    op.add_column(
        "ingressos",
        sa.Column("promoter_codigo", sa.String(length=32), nullable=True),
    )
    op.create_index("ix_ingressos_promoter_id", "ingressos", ["promoter_id"])
    op.create_foreign_key(
        "fk_ingressos_promoter_id",
        "ingressos",
        "evento_promoters",
        ["promoter_id"],
        ["id"],
        ondelete="SET NULL",
    )

    op.create_table(
        "evento_galeria_fotos",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("evento_id", sa.String(), nullable=False),
        sa.Column("url", sa.Text(), nullable=False),
        sa.Column("ordem", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("criado_em", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["evento_id"], ["eventos.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_evento_galeria_fotos_evento_id", "evento_galeria_fotos", ["evento_id"])


def downgrade() -> None:
    op.drop_index("ix_evento_galeria_fotos_evento_id", table_name="evento_galeria_fotos")
    op.drop_table("evento_galeria_fotos")

    op.drop_constraint("fk_ingressos_promoter_id", "ingressos", type_="foreignkey")
    op.drop_index("ix_ingressos_promoter_id", table_name="ingressos")
    op.drop_column("ingressos", "promoter_codigo")
    op.drop_column("ingressos", "promoter_id")

    op.drop_index("ix_evento_promoters_organizador_id", table_name="evento_promoters")
    op.drop_index("ix_evento_promoters_evento_id", table_name="evento_promoters")
    op.drop_table("evento_promoters")

    op.drop_index("ix_ingressos_carrinho_lembrete_enviado_em", table_name="ingressos")
    op.drop_column("ingressos", "carrinho_lembrete_enviado_em")
