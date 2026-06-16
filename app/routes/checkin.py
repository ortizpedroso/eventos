"""Check-in de ingressos na portaria (organizador)."""

from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.models import Usuario, get_db
from app.routes.auth import get_usuario_atual
from app.deps.rate_limit import rate_limit_checkin, rate_limit_checkin_buscar
from app.services.ingresso_busca import buscar_ingressos_organizador
from app.services.ingresso_checkin import realizar_checkin, realizar_checkin_por_id

logger = logging.getLogger(__name__)
router = APIRouter()


class CheckinRequest(BaseModel):
    codigo: str = Field(min_length=4, max_length=500)


class CheckinBuscarRequest(BaseModel):
    q: str = Field(min_length=2, max_length=120)
    evento_id: str | None = Field(default=None, min_length=8, max_length=64)


class CheckinValidarIdRequest(BaseModel):
    ingresso_id: str = Field(min_length=8, max_length=64)


class IngressoBuscaItem(BaseModel):
    ingresso_id: str
    participante_nome: str | None
    participante_email: str | None
    participante_cpf: str | None
    status: str
    checkin_em: str | None
    evento_id: str
    evento_nome: str
    lote_nome: str | None = None


class CheckinBuscarResponse(BaseModel):
    resultados: list[IngressoBuscaItem]


def _require_organizador(usuario: Usuario) -> None:
    if usuario.tipo != "organizador":
        raise HTTPException(status_code=403, detail="Apenas organizadores podem validar ingressos")


@router.post("/validar")
async def validar_checkin(
    body: CheckinRequest,
    usuario_atual: Usuario = Depends(get_usuario_atual),
    db: Session = Depends(get_db),
    _rate: None = Depends(rate_limit_checkin),
):
    _require_organizador(usuario_atual)
    try:
        return realizar_checkin(db, usuario_atual, body.codigo)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e


@router.post("/buscar", response_model=CheckinBuscarResponse)
async def buscar_checkin(
    body: CheckinBuscarRequest,
    usuario_atual: Usuario = Depends(get_usuario_atual),
    db: Session = Depends(get_db),
    _rate: None = Depends(rate_limit_checkin_buscar),
):
    _require_organizador(usuario_atual)
    itens = buscar_ingressos_organizador(
        db, usuario_atual, body.q, evento_id=body.evento_id
    )
    return CheckinBuscarResponse(resultados=itens)


@router.post("/validar-id")
async def validar_checkin_por_id(
    body: CheckinValidarIdRequest,
    usuario_atual: Usuario = Depends(get_usuario_atual),
    db: Session = Depends(get_db),
    _rate: None = Depends(rate_limit_checkin),
):
    _require_organizador(usuario_atual)
    try:
        return realizar_checkin_por_id(db, usuario_atual, body.ingresso_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
