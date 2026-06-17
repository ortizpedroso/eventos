from datetime import datetime, timezone
import uuid

from sqlalchemy import Column, DateTime, ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import relationship

from config.database import Base


class EventoListaInteresse(Base):
    __tablename__ = "evento_lista_interesse"
    __table_args__ = (UniqueConstraint("evento_id", "email", name="uq_lista_interesse_evento_email"),)

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    evento_id = Column(String, ForeignKey("eventos.id", ondelete="CASCADE"), index=True, nullable=False)
    email = Column(String, nullable=False)
    nome = Column(String, nullable=True)
    data_criacao = Column(
        DateTime,
        default=lambda: datetime.now(timezone.utc).replace(tzinfo=None),
        nullable=False,
    )

    evento = relationship("Evento", back_populates="lista_interesse")
