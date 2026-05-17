"""Campanhas de marketing enviadas pelo operador da plataforma."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import relationship

from config.database import Base


class CampanhaMarketing(Base):
    __tablename__ = "campanhas_marketing"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    nome = Column(String(200), nullable=False)
    assunto = Column(String(200), nullable=False)
    mensagem = Column(Text, nullable=False)
    canal = Column(String(12), nullable=False)  # email | whatsapp | ambos
    status = Column(String(20), nullable=False, default="rascunho")
    total_destinatarios = Column(Integer, nullable=False, default=0)
    enviados_ok = Column(Integer, nullable=False, default=0)
    enviados_erro = Column(Integer, nullable=False, default=0)
    criado_em = Column(
        DateTime,
        nullable=False,
        default=lambda: datetime.now(timezone.utc).replace(tzinfo=None),
    )
    disparado_em = Column(DateTime, nullable=True)

    envios = relationship(
        "CampanhaEnvio",
        back_populates="campanha",
        cascade="all, delete-orphan",
    )


class CampanhaEnvio(Base):
    __tablename__ = "campanha_envios"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    campanha_id = Column(String, ForeignKey("campanhas_marketing.id", ondelete="CASCADE"), nullable=False)
    usuario_id = Column(String, nullable=True)
    nome = Column(String(200), nullable=False)
    email = Column(String(255), nullable=True)
    telefone = Column(String(20), nullable=True)
    canal_envio = Column(String(12), nullable=False)
    status = Column(String(20), nullable=False, default="pendente")
    erro_msg = Column(String(500), nullable=True)
    enviado_em = Column(DateTime, nullable=True)

    campanha = relationship("CampanhaMarketing", back_populates="envios")
