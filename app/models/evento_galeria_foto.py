from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship

from config.database import Base


class EventoGaleriaFoto(Base):
    __tablename__ = "evento_galeria_fotos"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    evento_id = Column(String, ForeignKey("eventos.id", ondelete="CASCADE"), nullable=False, index=True)
    url = Column(Text, nullable=False)
    ordem = Column(Integer, nullable=False, default=0)
    criado_em = Column(
        DateTime,
        nullable=False,
        default=lambda: datetime.now(timezone.utc).replace(tzinfo=None),
    )

    evento = relationship("Evento", back_populates="galeria_fotos")

    def __repr__(self) -> str:
        return f"<EventoGaleriaFoto {self.id}>"
