from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.utils.imagem_url import validar_imagem_url
from app.utils.ingresso_tipos import TIPO_PADRAO, normalizar_tipo_ingresso, lote_e_cortesia
from datetime import datetime
from typing import TYPE_CHECKING, Any, Optional

if TYPE_CHECKING:
    from sqlalchemy.orm import Session

    from app.models.evento import Evento


class IngressoLoteWrite(BaseModel):
    """Payload para criar/atualizar um lote (id opcional = já existente no evento)."""

    id: str | None = None
    nome: str = Field(min_length=1, max_length=120)
    tipo: str = Field(default=TIPO_PADRAO, max_length=20)
    preco: float = Field(ge=0, le=500_000)
    ordem: int = Field(default=1, ge=1, le=999)
    quantidade_maxima: int | None = Field(default=None, ge=1)
    ativo: bool = True
    vendas_inicio: datetime | None = None
    vendas_fim: datetime | None = None

    @field_validator("tipo", mode="before")
    @classmethod
    def _tipo_lote(cls, v: object) -> str:
        return normalizar_tipo_ingresso(str(v) if v is not None else TIPO_PADRAO)

    @model_validator(mode="after")
    def _preco_por_tipo(self):
        if lote_e_cortesia(self.tipo):
            if self.preco < 0:
                raise ValueError("preço da cortesia não pode ser negativo")
        elif self.preco < 0.5:
            raise ValueError("preço mínimo de R$ 0,50 para lotes pagos")
        return self


class IngressoLoteResponse(BaseModel):
    id: str
    nome: str
    tipo: str = TIPO_PADRAO
    preco: float
    ordem: int
    quantidade_maxima: int | None
    ativo: bool
    vendas_inicio: datetime | None
    vendas_fim: datetime | None
    vendidos: int = 0

    model_config = ConfigDict(from_attributes=True)


class CriarEventoRequest(BaseModel):
    nome: str
    descricao: str
    data_inicio: datetime
    # Opcional: eventos de um dia (show, feijoada) usam só início; se omitido, replica data_inicio.
    data_fim: datetime | None = None
    local: str
    imagem_url: Optional[str] = Field(default=None, max_length=2048)
    # Reais (ex.: 49.9). Mínimo alinhado ao Stripe para ingressos pagos.
    preco_ingresso: float = Field(ge=0, le=500_000)
    categoria: str = Field(default="Outros", min_length=1, max_length=80)
    mensagem_confirmacao: Optional[str] = Field(default=None, max_length=2000)
    # False = pausado (não aparece na listagem pública; só o organizador vê com login).
    publicado: bool = True
    limite_ingressos_por_cpf: int | None = Field(default=None, ge=1, le=50)
    ingresso_lotes: list[IngressoLoteWrite] | None = None

    @field_validator("imagem_url", mode="before")
    @classmethod
    def _imagem_url(cls, v: object) -> str | None:
        return validar_imagem_url(v)

    @model_validator(mode="after")
    def validar_datas(self):
        fim = self.data_fim
        if fim is not None and fim < self.data_inicio:
            raise ValueError("data_fim deve ser posterior ou igual a data_inicio")
        return self

    @model_validator(mode="after")
    def validar_lotes(self):
        if self.ingresso_lotes is not None and len(self.ingresso_lotes) == 0:
            raise ValueError("ingresso_lotes não pode ser uma lista vazia; omita o campo ou envie pelo menos um lote.")
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
    limite_ingressos_por_cpf: int | None = None
    data_criacao: datetime
    ingresso_lotes: list[IngressoLoteResponse] = Field(default_factory=list)
    lote_compra_id: str | None = None
    preco_compra: float | None = None

    model_config = ConfigDict(from_attributes=True)


def montar_evento_response(
    db: "Session",
    evento: "Evento",
    *,
    ocupacao_por_lote: dict[str, int] | None = None,
) -> EventoResponse:
    from app.services.ingresso_lotes import contar_ocupacao_por_lotes, resolver_lote_compra

    lotes_orm = sorted(evento.ingresso_lotes, key=lambda x: (x.ordem, x.id))
    if ocupacao_por_lote is None:
        ocupacao_por_lote = contar_ocupacao_por_lotes(db, [l.id for l in lotes_orm])
    lotes_out: list[IngressoLoteResponse] = []
    for l in lotes_orm:
        lotes_out.append(
            IngressoLoteResponse(
                id=l.id,
                nome=l.nome,
                tipo=getattr(l, "tipo", TIPO_PADRAO) or TIPO_PADRAO,
                preco=l.preco,
                ordem=l.ordem,
                quantidade_maxima=l.quantidade_maxima,
                ativo=l.ativo,
                vendas_inicio=l.vendas_inicio,
                vendas_fim=l.vendas_fim,
                vendidos=ocupacao_por_lote.get(l.id, 0),
            )
        )
    cur = resolver_lote_compra(db, evento, ocupacao_por_lote=ocupacao_por_lote)
    preco_compra = float(cur.preco) if cur is not None else float(evento.preco_ingresso)
    lote_compra_id = cur.id if cur is not None else None

    base: dict[str, Any] = {
        "id": evento.id,
        "slug": evento.slug,
        "organizador_id": evento.organizador_id,
        "nome": evento.nome,
        "descricao": evento.descricao,
        "data_inicio": evento.data_inicio,
        "data_fim": evento.data_fim,
        "local": evento.local,
        "imagem_url": evento.imagem_url,
        "preco_ingresso": evento.preco_ingresso,
        "categoria": evento.categoria,
        "mensagem_confirmacao": evento.mensagem_confirmacao,
        "publicado": evento.publicado,
        "limite_ingressos_por_cpf": getattr(evento, "limite_ingressos_por_cpf", None),
        "data_criacao": evento.data_criacao,
        "ingresso_lotes": lotes_out,
        "lote_compra_id": lote_compra_id,
        "preco_compra": preco_compra,
    }
    return EventoResponse.model_validate(base)


class EventoPublicoResponse(EventoResponse):
    organizador_nome: str
