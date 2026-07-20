from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import Column, DateTime, ForeignKey, Numeric, String, Text
from sqlalchemy.orm import relationship

from config.database import Base


class FinanceiroSaque(Base):
    __tablename__ = "financeiro_saques"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    organizador_id = Column(String, ForeignKey("usuarios.id"), nullable=False, index=True)
    valor = Column(Numeric(12, 2), nullable=False)
    pix_chave = Column(String(120), nullable=False)
    pix_tipo = Column(String(20), nullable=False, default="EVP")
    status = Column(String(20), nullable=False, default="pendente")
    asaas_transfer_id = Column(String(64), nullable=True, index=True)
    previsao_liquidacao_em = Column(DateTime, nullable=True)
    processado_em = Column(DateTime, nullable=True)
    observacao = Column(Text, nullable=True)
    criado_em = Column(DateTime, default=lambda: datetime.now(timezone.utc).replace(tzinfo=None))
    atualizado_em = Column(
        DateTime,
        default=lambda: datetime.now(timezone.utc).replace(tzinfo=None),
        onupdate=lambda: datetime.now(timezone.utc).replace(tzinfo=None),
    )

    organizador = relationship("Usuario", backref="saques_financeiros")
