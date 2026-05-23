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
    participante_cpf = Column(String(14), nullable=True)
    participante_telefone = Column(String(20), nullable=True)

    # Stripe
    stripe_payment_intent_id = Column(String, unique=True, index=True)

    valor = Column(Float)
    status = Column(String, default="pendente")  # pendente, pago, cancelado, usado

    lote_id = Column(String, ForeignKey("evento_ingresso_lotes.id"), nullable=True, index=True)
    cupom_id = Column(String, ForeignKey("evento_cupons.id", ondelete="SET NULL"), nullable=True)
    cortesia_responsavel = Column(String(200), nullable=True)

    # Repasse / transferência para outro participante
    repassado_para_nome = Column(String(200), nullable=True)
    repassado_para_cpf = Column(String(14), nullable=True)
    repassado_para_email = Column(String(255), nullable=True)
    repassado_para_telefone = Column(String(20), nullable=True)
    repassado_para_data_nascimento = Column(String(10), nullable=True)
    repassado_em = Column(DateTime, nullable=True)

    # Check-in na portaria
    checkin_em = Column(DateTime, nullable=True)
    checkin_por_id = Column(String, ForeignKey("usuarios.id"), nullable=True)

    # Datas
    data_compra = Column(DateTime, default=lambda: datetime.now(timezone.utc).replace(tzinfo=None))
    data_limite_cancelamento = Column(DateTime)

    # Relacionamentos
    evento = relationship("Evento", back_populates="ingressos")
    usuario = relationship(
        "Usuario",
        back_populates="ingressos",
        foreign_keys=[usuario_id],
    )
    checkin_por = relationship("Usuario", foreign_keys=[checkin_por_id])
    lote = relationship("EventoIngressoLote", back_populates="ingressos")
    cupom = relationship("EventoCupom", back_populates="ingressos")
    cancelamento = relationship("Cancelamento", back_populates="ingresso", uselist=False, cascade="all, delete-orphan")

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        if not getattr(self, 'data_compra', None):
            self.data_compra = datetime.now(timezone.utc).replace(tzinfo=None)
        if not self.data_limite_cancelamento:
            self.data_limite_cancelamento = self.data_compra + timedelta(days=10)

    def __repr__(self):
        return f"<Ingresso {self.id}>"
