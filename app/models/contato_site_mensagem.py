"""Mensagens do formulário público Fale conosco."""

import uuid

from sqlalchemy import Boolean, Column, DateTime, String, Text, func

from config.database import Base


class ContatoSiteMensagem(Base):
    __tablename__ = "contato_site_mensagens"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    nome = Column(String(200), nullable=False)
    email = Column(String(255), nullable=False)
    assunto = Column(String(200), nullable=False)
    mensagem = Column(Text, nullable=False)
    email_enviado = Column(Boolean, nullable=False, default=False, server_default="false")
    criado_em = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
