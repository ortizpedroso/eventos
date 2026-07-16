from sqlalchemy import Column, String, DateTime, ForeignKey, Text, Boolean, Float, Integer
from sqlalchemy.orm import relationship
from datetime import datetime, timezone
import uuid
from config.database import Base
from slugify import slugify

class Evento(Base):
    __tablename__ = "eventos"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    slug = Column(String, unique=True, index=True)

    organizador_id = Column(String, ForeignKey("usuarios.id"))

    nome = Column(String, index=True)
    descricao = Column(Text)
    data_inicio = Column(DateTime)
    data_fim = Column(DateTime, nullable=False)
    local = Column(String)
    cidade = Column(String(120), nullable=True, index=True)
    imagem_url = Column(Text, nullable=True)

    categoria = Column(String(80), nullable=False, default="Outros")
    mensagem_confirmacao = Column(Text, nullable=True)

    # Preço sugerido do ingresso (reais); usado na página pública e na compra.
    preco_ingresso = Column(Float, nullable=False, default=10.0)

    # Máximo de ingressos ativos por CPF neste evento (null = sem limite).
    limite_ingressos_por_cpf = Column(Integer, nullable=True)

    # Asaas split — wallet do organizador no momento da criação do evento
    asaas_wallet_id = Column(String, nullable=True)

    # Urgência / escassez (desligado | exato | faixa)
    urgencia_modo = Column(String(20), nullable=False, default="desligado")
    # Parcelamento no cartão (Asaas)
    parcelamento_habilitado = Column(Boolean, default=False, nullable=False)
    parcelamento_max = Column(Integer, nullable=False, default=2)
    # comprador | organizador — quem absorve acréscimo de parcelamento
    repasse_parcelamento = Column(String(16), nullable=False, default="comprador")
    # Lista de interesse (pré-venda)
    aceita_interesse = Column(Boolean, default=True, nullable=False)
    # Lista de espera (esgotado)
    lista_espera_habilitada = Column(Boolean, default=False, nullable=False)
    lista_espera_prazo_horas = Column(Integer, nullable=False, default=24)

    # Status
    publicado = Column(Boolean, default=True)

    # Link secreto para colaboradores validarem ingressos na portaria (/portaria/{id}?k=...)
    checkin_token = Column(String(64), nullable=True, unique=True, index=True)
    checkin_token_em = Column(DateTime, nullable=True)

    # Notificação de interesse (idempotência)
    notificacao_interesse_enviada_em = Column(DateTime, nullable=True)

    # Datas
    data_criacao = Column(DateTime, default=lambda: datetime.now(timezone.utc).replace(tzinfo=None))
    data_atualizacao = Column(DateTime, default=lambda: datetime.now(timezone.utc).replace(tzinfo=None), onupdate=lambda: datetime.now(timezone.utc).replace(tzinfo=None))

    # Relacionamentos
    organizador = relationship("Usuario", back_populates="eventos")
    ingressos = relationship("Ingresso", back_populates="evento", cascade="all, delete-orphan")
    ingresso_lotes = relationship(
        "EventoIngressoLote",
        back_populates="evento",
        order_by="EventoIngressoLote.ordem",
        cascade="all, delete-orphan",
    )
    cupons = relationship(
        "EventoCupom",
        back_populates="evento",
        cascade="all, delete-orphan",
    )
    lista_interesse = relationship(
        "EventoListaInteresse",
        back_populates="evento",
        cascade="all, delete-orphan",
    )
    lista_espera = relationship(
        "EventoListaEspera",
        back_populates="evento",
        cascade="all, delete-orphan",
    )

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        if not self.slug and self.nome:
            self.slug = slugify(self.nome)

    def __repr__(self):
        return f"<Evento {self.nome}>"
