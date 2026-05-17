from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class CampanhaCreate(BaseModel):
    nome: str = Field(min_length=2, max_length=200)
    assunto: str = Field(min_length=3, max_length=200)
    mensagem: str = Field(min_length=10, max_length=8000)
    canal: str = Field(pattern="^(email|whatsapp|ambos)$")
    usuario_ids: list[str] = Field(default_factory=list, max_length=5000)
    busca: str | None = Field(default=None, max_length=120)
    filtro_canal: str = Field(default="qualquer", pattern="^(email|whatsapp|qualquer)$")
    disparar_agora: bool = False


class CampanhaEnvioResponse(BaseModel):
    id: str
    usuario_id: str | None
    nome: str
    email: str | None
    telefone: str | None
    canal_envio: str
    status: str
    erro_msg: str | None
    enviado_em: datetime | None

    model_config = ConfigDict(from_attributes=True)


class CampanhaResponse(BaseModel):
    id: str
    nome: str
    assunto: str
    mensagem: str
    canal: str
    status: str
    total_destinatarios: int
    enviados_ok: int
    enviados_erro: int
    criado_em: datetime
    disparado_em: datetime | None

    model_config = ConfigDict(from_attributes=True)


class CampanhaDetalheResponse(CampanhaResponse):
    envios: list[CampanhaEnvioResponse] = Field(default_factory=list)
