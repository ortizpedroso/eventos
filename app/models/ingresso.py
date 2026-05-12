from sqlalchemy import Column, String, Float, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime, timedelta, timezone
import uuid
from config.database import Base

class Ingresso(Base):
    __tablename__ = "ingressos"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    evento_id = Column(String, ForeignKey("eventos.id"))
    usuario_id = Column(String, ForeignKey("usuarios.id"))

    # Quem vai ao evento (pode ser diferente do responsável financeiro = usuario_id).
    participante_nome = Column(String(200), nullable=True)
    participante_email = Column(String(255), nullable=True)

    # Stripe
    stripe_payment_intent_id = Column(String, unique=True, index=True)

    valor = Column(Float)
    status = Column(String, default="pendente")  # pendente, pago, cancelado, usado

    # Datas
    data_compra = Column(DateTime, default=lambda: datetime.now(timezone.utc).replace(tzinfo=None))
    data_limite_cancelamento = Column(DateTime)

    # Relacionamentos
    evento = relationship("Evento", back_populates="ingressos")
    usuario = relationship("Usuario", back_populates="ingressos")
    cancelamento = relationship("Cancelamento", back_populates="ingresso", uselist=False, cascade="all, delete-orphan")

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        if not getattr(self, 'data_compra', None):
            self.data_compra = datetime.now(timezone.utc).replace(tzinfo=None)
        if not self.data_limite_cancelamento:
            self.data_limite_cancelamento = self.data_compra + timedelta(days=10)

    def __repr__(self):
        return f"<Ingresso {self.id}>"
