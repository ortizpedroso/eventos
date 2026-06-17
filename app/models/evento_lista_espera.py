from datetime import datetime, timezone
import uuid

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import relationship

from config.database import Base


class EventoListaEspera(Base):
    __tablename__ = "evento_lista_espera"
    __table_args__ = (UniqueConstraint("evento_id", "email", name="uq_lista_espera_evento_email"),)

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    evento_id = Column(String, ForeignKey("eventos.id", ondelete="CASCADE"), index=True, nullable=False)
    usuario_id = Column(String, ForeignKey("usuarios.id", ondelete="SET NULL"), nullable=True)
    email = Column(String, nullable=False)
    nome = Column(String, nullable=True)
    posicao = Column(Integer, nullable=False)
    status = Column(String(20), nullable=False, default="aguardando")
    token_compra = Column(String(64), nullable=True, unique=True, index=True)
    token_expira_em = Column(DateTime, nullable=True)
    notificado_em = Column(DateTime, nullable=True)
    data_criacao = Column(
        DateTime,
        default=lambda: datetime.now(timezone.utc).replace(tzinfo=None),
        nullable=False,
    )

    evento = relationship("Evento", back_populates="lista_espera")
    usuario = relationship("Usuario", back_populates="lista_espera")
