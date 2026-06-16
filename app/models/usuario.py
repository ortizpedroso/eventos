from sqlalchemy import Column, String, DateTime, Boolean, Integer
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
import uuid
from config.database import Base

class Usuario(Base):
    __tablename__ = "usuarios"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    email = Column(String, unique=True, index=True)
    nome = Column(String)
    senha_hash = Column(String, nullable=True)
    # email | google | apple
    auth_provider = Column(String(20), default="email", nullable=False)
    auth_provider_id = Column(String(255), nullable=True, index=True)
    tipo = Column(String)  # "cliente" ou "organizador"

    # Stripe (legado)
    stripe_customer_id = Column(String, nullable=True)
    stripe_account_id = Column(String, nullable=True)

    # Asaas
    asaas_customer_id = Column(String, nullable=True)
    asaas_wallet_id = Column(String, nullable=True)
    asaas_account_id = Column(String, nullable=True)

    # Status
    ativo = Column(Boolean, default=True)
    # Incrementado ao desativar conta ou alterar senha — invalida JWTs antigos.
    token_version = Column(Integer, default=0, nullable=False)

    # Marketing EventosBR (opt-in LGPD)
    aceita_comunicacao_email = Column(Boolean, default=False, nullable=False)
    aceita_comunicacao_whatsapp = Column(Boolean, default=False, nullable=False)
    telefone = Column(String(20), nullable=True)
    comunicacao_consentimento_em = Column(DateTime, nullable=True)

    # Recuperação de senha (token único, expira em 1 h)
    senha_reset_token = Column(String(64), nullable=True, index=True)
    senha_reset_expires = Column(DateTime, nullable=True)

    # Verificação de e-mail (compra rápida / reenvio)
    email_verificado = Column(Boolean, default=True, nullable=False)
    email_verificacao_token = Column(String(64), nullable=True, index=True)
    email_verificacao_expires = Column(DateTime, nullable=True)

    # Datas
    data_criacao = Column(DateTime, default=lambda: datetime.now(timezone.utc).replace(tzinfo=None))
    data_atualizacao = Column(DateTime, default=lambda: datetime.now(timezone.utc).replace(tzinfo=None), onupdate=lambda: datetime.now(timezone.utc).replace(tzinfo=None))

    # Relacionamentos
    eventos = relationship("Evento", back_populates="organizador")
    ingressos = relationship(
        "Ingresso",
        back_populates="usuario",
        foreign_keys="Ingresso.usuario_id",
    )

    def __repr__(self):
        return f"<Usuario {self.email}>"

    @property
    def tem_senha(self) -> bool:
        return bool(self.senha_hash)
