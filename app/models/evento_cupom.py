from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import Boolean, Column, DateTime, Float, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import relationship

from config.database import Base


class EventoCupom(Base):
    __tablename__ = "evento_cupons"
    __table_args__ = (UniqueConstraint("evento_id", "codigo", name="uq_evento_cupom_codigo"),)

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    evento_id = Column(String, ForeignKey("eventos.id", ondelete="CASCADE"), nullable=False, index=True)
    codigo = Column(String(40), nullable=False)
    tipo = Column(String(12), nullable=False)  # percentual | fixo
    valor = Column(Float, nullable=False)
    max_usos = Column(Integer, nullable=True)
    usos = Column(Integer, nullable=False, default=0)
    ativo = Column(Boolean, nullable=False, default=True)
    valido_ate = Column(DateTime, nullable=True)

    evento = relationship("Evento", back_populates="cupons")
    ingressos = relationship("Ingresso", back_populates="cupom")

    def __repr__(self) -> str:
        return f"<EventoCupom {self.codigo}>"
