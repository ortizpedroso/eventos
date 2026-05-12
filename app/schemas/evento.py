from pydantic import BaseModel, ConfigDict, Field, model_validator
from datetime import datetime
from typing import Optional


class CriarEventoRequest(BaseModel):
    nome: str
    descricao: str
    data_inicio: datetime
    data_fim: datetime
    local: str
    imagem_url: Optional[str] = Field(default=None, max_length=2_000_000)
    # Reais (ex.: 49.9). Mínimo alinhado ao Stripe para ingressos pagos.
    preco_ingresso: float = Field(ge=0.5, le=500_000)
    categoria: str = Field(default="Outros", min_length=1, max_length=80)
    mensagem_confirmacao: Optional[str] = Field(default=None, max_length=2000)
    # False = pausado (não aparece na listagem pública; só o organizador vê com login).
    publicado: bool = True

    @model_validator(mode="after")
    def validar_datas(self):
        if self.data_fim < self.data_inicio:
            raise ValueError("data_fim deve ser posterior ou igual a data_inicio")
        return self


class AtualizarEventoRequest(CriarEventoRequest):
    """Mesmos campos da criação; o slug da URL não é alterado na atualização."""


class EventoResponse(BaseModel):
    id: str
    slug: str
    organizador_id: str
    nome: str
    descricao: str
    data_inicio: datetime
    data_fim: datetime
    local: str
    imagem_url: Optional[str]
    preco_ingresso: float
    categoria: str
    mensagem_confirmacao: Optional[str]
    publicado: bool
    data_criacao: datetime

    model_config = ConfigDict(from_attributes=True)


class EventoPublicoResponse(EventoResponse):
    organizador_nome: str
