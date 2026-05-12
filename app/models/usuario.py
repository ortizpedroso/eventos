from sqlalchemy import Column, String, DateTime, Boolean
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
import uuid
from config.database import Base

class Usuario(Base):
    __tablename__ = "usuarios"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    email = Column(String, unique=True, index=True)
    nome = Column(String)
    senha_hash = Column(String)
    tipo = Column(String)  # "cliente" ou "organizador"

    # Stripe
    stripe_customer_id = Column(String, nullable=True)
    stripe_account_id = Column(String, nullable=True)

    # Status
    ativo = Column(Boolean, default=True)

    # Datas
    data_criacao = Column(DateTime, default=lambda: datetime.now(timezone.utc).replace(tzinfo=None))
    data_atualizacao = Column(DateTime, default=lambda: datetime.now(timezone.utc).replace(tzinfo=None), onupdate=lambda: datetime.now(timezone.utc).replace(tzinfo=None))

    # Relacionamentos
    eventos = relationship("Evento", back_populates="organizador")
    ingressos = relationship("Ingresso", back_populates="usuario")

    def __repr__(self):
        return f"<Usuario {self.email}>"
