from datetime import datetime, timezone
import uuid

from sqlalchemy import Column, DateTime, String

from config.database import Base


class RegistroAcesso(Base):
    """IP e horário de uso da aplicação (Marco Civil da Internet, art. 15)."""

    __tablename__ = "registros_acesso"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    criado_em = Column(
        DateTime, nullable=False, index=True, default=lambda: datetime.now(timezone.utc).replace(tzinfo=None)
    )
    acao = Column(String(30), nullable=False)
    usuario_id = Column(String, nullable=True, index=True)
    referencia = Column(String(64), nullable=True)
    ip = Column(String(64), nullable=False)
    user_agent = Column(String(300), nullable=True)
