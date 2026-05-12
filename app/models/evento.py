from sqlalchemy import Column, String, DateTime, ForeignKey, Text, Boolean, Float
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
    imagem_url = Column(String, nullable=True)

    categoria = Column(String(80), nullable=False, default="Outros")
    mensagem_confirmacao = Column(Text, nullable=True)

    # Preço sugerido do ingresso (reais); usado na página pública e na compra.
    preco_ingresso = Column(Float, nullable=False, default=10.0)

    # Stripe
    stripe_account_id = Column(String)

    # Status
    publicado = Column(Boolean, default=True)

    # Datas
    data_criacao = Column(DateTime, default=lambda: datetime.now(timezone.utc).replace(tzinfo=None))
    data_atualizacao = Column(DateTime, default=lambda: datetime.now(timezone.utc).replace(tzinfo=None), onupdate=lambda: datetime.now(timezone.utc).replace(tzinfo=None))

    # Relacionamentos
    organizador = relationship("Usuario", back_populates="eventos")
    ingressos = relationship("Ingresso", back_populates="evento", cascade="all, delete-orphan")

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        if not self.slug and self.nome:
            self.slug = slugify(self.nome)

    def __repr__(self):
        return f"<Evento {self.nome}>"
