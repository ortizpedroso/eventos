import sqlalchemy as sa
from sqlalchemy import Column, String, DateTime, Boolean, Integer, Text
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

    # Asaas (motor invisível de repasses)
    asaas_customer_id = Column(String, nullable=True)
    asaas_wallet_id = Column(String, nullable=True)
    asaas_account_id = Column(String, nullable=True)
    asaas_subaccount_api_key = Column(String, nullable=True)
    # pending | awaiting_approval | approved | rejected | manual
    asaas_repasse_status = Column(String(32), nullable=True)
    asaas_repasse_status_em = Column(DateTime, nullable=True)
    asaas_repasse_detalhes = Column(Text, nullable=True)
    # CPF/CNPJ cifrado em repouso (encrypt_at_rest) — Text para acomodar enc:v2.
    asaas_repasse_cpf_cnpj = Column(sa.Text, nullable=True)
    # Opt-in antecipação automática no cartão (espelho da config Asaas)
    asaas_anticipacao_cartao = Column(Boolean, nullable=True)

    # plano_tarifa: padrao | assinatura (taxa por ingresso no split)
    plano_tarifa = Column(String(16), default="padrao", nullable=False)
    assinatura_valida_ate = Column(DateTime, nullable=True)
    assinatura_ultimo_payment_id = Column(String(64), nullable=True)
    assinatura_aviso_expiracao_enviado_em = Column(DateTime, nullable=True)
    assinatura_renovacao_payment_id = Column(String(64), nullable=True)
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

    # Perfil público (/produtor/[slug])
    slug_publico = Column(String, unique=True, index=True, nullable=True)
    bio = Column(Text, nullable=True)
    foto_url = Column(Text, nullable=True)
    social_instagram = Column(String, nullable=True)
    social_whatsapp = Column(String, nullable=True)
    social_site = Column(String, nullable=True)

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
    notificacoes = relationship(
        "UsuarioNotificacao",
        back_populates="usuario",
        cascade="all, delete-orphan",
    )
    lista_espera = relationship("EventoListaEspera", back_populates="usuario")

    def __repr__(self):
        return f"<Usuario {self.email}>"

    @property
    def tem_senha(self) -> bool:
        return bool(self.senha_hash)
