"""eventos — suspensão pela plataforma; registros_acesso — IP e horário (Marco Civil art. 15)."""

from alembic import op
import sqlalchemy as sa

revision = "20261128_000055"
down_revision = "20261127_000054"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("eventos", sa.Column("suspenso_em", sa.DateTime(), nullable=True))
    op.add_column("eventos", sa.Column("suspenso_motivo", sa.String(20), nullable=True))
    op.add_column("eventos", sa.Column("suspenso_detalhe", sa.Text(), nullable=True))
    op.add_column("eventos", sa.Column("suspenso_por", sa.String(255), nullable=True))
    op.create_table(
        "registros_acesso",
        sa.Column("id", sa.String(), primary_key=True),
        sa.Column("criado_em", sa.DateTime(), nullable=False),
        sa.Column("acao", sa.String(30), nullable=False),
        sa.Column("usuario_id", sa.String(), nullable=True),
        sa.Column("referencia", sa.String(64), nullable=True),
        sa.Column("ip", sa.String(64), nullable=False),
        sa.Column("user_agent", sa.String(300), nullable=True),
    )
    op.create_index("ix_registros_acesso_criado_em", "registros_acesso", ["criado_em"])
    op.create_index("ix_registros_acesso_usuario_id", "registros_acesso", ["usuario_id"])


def downgrade() -> None:
    op.drop_index("ix_registros_acesso_usuario_id", table_name="registros_acesso")
    op.drop_index("ix_registros_acesso_criado_em", table_name="registros_acesso")
    op.drop_table("registros_acesso")
    op.drop_column("eventos", "suspenso_por")
    op.drop_column("eventos", "suspenso_detalhe")
    op.drop_column("eventos", "suspenso_motivo")
    op.drop_column("eventos", "suspenso_em")
