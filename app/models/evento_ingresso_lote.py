from sqlalchemy import Boolean, Column, DateTime, Float, ForeignKey, Integer, String
from sqlalchemy.orm import relationship
import uuid

from config.database import Base


class EventoIngressoLote(Base):
    """Lote de ingressos (preço, ordem, capacidade opcional, janela de vendas)."""

    __tablename__ = "evento_ingresso_lotes"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    evento_id = Column(String, ForeignKey("eventos.id", ondelete="CASCADE"), nullable=False, index=True)

    nome = Column(String(120), nullable=False)
    tipo = Column(String(20), nullable=False, default="inteira")
    preco = Column(Float, nullable=False)
    ordem = Column(Integer, nullable=False, default=1)
    quantidade_maxima = Column(Integer, nullable=True)
    ativo = Column(Boolean, nullable=False, default=True)
    vendas_inicio = Column(DateTime, nullable=True)
    vendas_fim = Column(DateTime, nullable=True)

    evento = relationship("Evento", back_populates="ingresso_lotes")
    ingressos = relationship("Ingresso", back_populates="lote")

    def __repr__(self) -> str:
        return f"<EventoIngressoLote {self.nome!r} {self.preco}>"
