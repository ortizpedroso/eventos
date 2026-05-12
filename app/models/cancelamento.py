from sqlalchemy import Column, String, Float, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
import uuid
from config.database import Base

class Cancelamento(Base):
    __tablename__ = "cancelamentos"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    ingresso_id = Column(String, ForeignKey("ingressos.id"), unique=True)

    valor_reembolso = Column(Float)
    status = Column(String, default="pendente")  # pendente, processado, falhou

    # Stripe
    stripe_refund_id = Column(String, nullable=True)

    # Datas
    data_solicitacao = Column(DateTime, default=lambda: datetime.now(timezone.utc).replace(tzinfo=None))
    data_processamento = Column(DateTime, nullable=True)

    # Relacionamentos
    ingresso = relationship("Ingresso", back_populates="cancelamento")

    def __repr__(self):
        return f"<Cancelamento {self.id}>"
