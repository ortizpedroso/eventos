from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import relationship

from config.database import Base


class EventoPromoter(Base):
    __tablename__ = "evento_promoters"
    __table_args__ = (UniqueConstraint("evento_id", "codigo", name="uq_evento_promoter_codigo"),)

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    evento_id = Column(String, ForeignKey("eventos.id", ondelete="CASCADE"), nullable=False, index=True)
    organizador_id = Column(String, ForeignKey("usuarios.id"), nullable=False, index=True)
    codigo = Column(String(32), nullable=False)
    rotulo = Column(String(120), nullable=True)
    ativo = Column(Boolean, nullable=False, default=True)
    criado_em = Column(
        DateTime,
        nullable=False,
        default=lambda: datetime.now(timezone.utc).replace(tzinfo=None),
    )

    evento = relationship("Evento", back_populates="promoters")
    ingressos = relationship("Ingresso", back_populates="promoter")

    def __repr__(self) -> str:
        return f"<EventoPromoter {self.codigo}>"
