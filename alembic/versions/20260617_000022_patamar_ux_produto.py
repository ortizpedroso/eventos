"""Patamar UX/produto: parcelamento, listas, urgência, perfil público.

Revision ID: 20260617_000022
Revises: 20260617_000021
"""

from alembic import op
import sqlalchemy as sa

revision = "20260617_000022"
down_revision = "20260617_000021"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "eventos",
        sa.Column("urgencia_modo", sa.String(length=20), nullable=False, server_default="desligado"),
    )
    op.add_column(
        "eventos",
        sa.Column("parcelamento_habilitado", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.add_column(
        "eventos",
        sa.Column("parcelamento_max", sa.Integer(), nullable=False, server_default="2"),
    )
    op.add_column(
        "eventos",
        sa.Column("aceita_interesse", sa.Boolean(), nullable=False, server_default=sa.true()),
    )
    op.add_column(
        "eventos",
        sa.Column("lista_espera_habilitada", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.add_column(
        "eventos",
        sa.Column("lista_espera_prazo_horas", sa.Integer(), nullable=False, server_default="24"),
    )

    op.add_column("usuarios", sa.Column("slug_publico", sa.String(), nullable=True))
    op.add_column("usuarios", sa.Column("bio", sa.Text(), nullable=True))
    op.add_column("usuarios", sa.Column("foto_url", sa.Text(), nullable=True))
    op.add_column("usuarios", sa.Column("social_instagram", sa.String(), nullable=True))
    op.add_column("usuarios", sa.Column("social_whatsapp", sa.String(), nullable=True))
    op.add_column("usuarios", sa.Column("social_site", sa.String(), nullable=True))
    op.create_index("ix_usuarios_slug_publico", "usuarios", ["slug_publico"], unique=True)

    op.create_table(
        "evento_lista_interesse",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("evento_id", sa.String(), sa.ForeignKey("eventos.id", ondelete="CASCADE"), nullable=False),
        sa.Column("email", sa.String(), nullable=False),
        sa.Column("nome", sa.String(), nullable=True),
        sa.Column("data_criacao", sa.DateTime(), nullable=False),
        sa.UniqueConstraint("evento_id", "email", name="uq_lista_interesse_evento_email"),
    )
    op.create_index("ix_evento_lista_interesse_evento_id", "evento_lista_interesse", ["evento_id"])

    op.create_table(
        "evento_lista_espera",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("evento_id", sa.String(), sa.ForeignKey("eventos.id", ondelete="CASCADE"), nullable=False),
        sa.Column("usuario_id", sa.String(), sa.ForeignKey("usuarios.id", ondelete="SET NULL"), nullable=True),
        sa.Column("email", sa.String(), nullable=False),
        sa.Column("nome", sa.String(), nullable=True),
        sa.Column("posicao", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="aguardando"),
        sa.Column("token_compra", sa.String(length=64), nullable=True),
        sa.Column("token_expira_em", sa.DateTime(), nullable=True),
        sa.Column("notificado_em", sa.DateTime(), nullable=True),
        sa.Column("data_criacao", sa.DateTime(), nullable=False),
        sa.UniqueConstraint("evento_id", "email", name="uq_lista_espera_evento_email"),
    )
    op.create_index("ix_evento_lista_espera_evento_id", "evento_lista_espera", ["evento_id"])
    op.create_index("ix_evento_lista_espera_token_compra", "evento_lista_espera", ["token_compra"], unique=True)

    op.create_table(
        "usuario_notificacoes",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("usuario_id", sa.String(), sa.ForeignKey("usuarios.id", ondelete="CASCADE"), nullable=False),
        sa.Column("tipo", sa.String(length=40), nullable=False),
        sa.Column("titulo", sa.String(length=200), nullable=False),
        sa.Column("mensagem", sa.Text(), nullable=False),
        sa.Column("link", sa.String(), nullable=True),
        sa.Column("lida", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("data_criacao", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_usuario_notificacoes_usuario_id", "usuario_notificacoes", ["usuario_id"])


def downgrade() -> None:
    op.drop_index("ix_usuario_notificacoes_usuario_id", table_name="usuario_notificacoes")
    op.drop_table("usuario_notificacoes")
    op.drop_index("ix_evento_lista_espera_token_compra", table_name="evento_lista_espera")
    op.drop_index("ix_evento_lista_espera_evento_id", table_name="evento_lista_espera")
    op.drop_table("evento_lista_espera")
    op.drop_index("ix_evento_lista_interesse_evento_id", table_name="evento_lista_interesse")
    op.drop_table("evento_lista_interesse")
    op.drop_index("ix_usuarios_slug_publico", table_name="usuarios")
    op.drop_column("usuarios", "social_site")
    op.drop_column("usuarios", "social_whatsapp")
    op.drop_column("usuarios", "social_instagram")
    op.drop_column("usuarios", "foto_url")
    op.drop_column("usuarios", "bio")
    op.drop_column("usuarios", "slug_publico")
    op.drop_column("eventos", "lista_espera_prazo_horas")
    op.drop_column("eventos", "lista_espera_habilitada")
    op.drop_column("eventos", "aceita_interesse")
    op.drop_column("eventos", "parcelamento_max")
    op.drop_column("eventos", "parcelamento_habilitado")
    op.drop_column("eventos", "urgencia_modo")
