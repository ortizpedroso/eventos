from datetime import datetime, timezone
import uuid

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, String, Text
from sqlalchemy.orm import relationship

from config.database import Base


class UsuarioNotificacao(Base):
    __tablename__ = "usuario_notificacoes"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    usuario_id = Column(String, ForeignKey("usuarios.id", ondelete="CASCADE"), index=True, nullable=False)
    tipo = Column(String(40), nullable=False)
    titulo = Column(String(200), nullable=False)
    mensagem = Column(Text, nullable=False)
    link = Column(String, nullable=True)
    lida = Column(Boolean, default=False, nullable=False)
    data_criacao = Column(
        DateTime,
        default=lambda: datetime.now(timezone.utc).replace(tzinfo=None),
        nullable=False,
    )

    usuario = relationship("Usuario", back_populates="notificacoes")
