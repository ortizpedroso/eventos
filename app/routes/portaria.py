"""Check-in na portaria via link secreto (colaboradores sem conta)."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.models import Evento, get_db
from app.services.evento_portaria import evento_por_token_portaria
from app.deps.rate_limit import rate_limit_portaria_info, rate_limit_portaria_validar
from app.services.ingresso_checkin import realizar_checkin_portaria

router = APIRouter()


class PortariaValidarRequest(BaseModel):
    evento_id: str = Field(min_length=8, max_length=64)
    token: str = Field(min_length=8, max_length=64)
    codigo: str = Field(min_length=4, max_length=500)


class PortariaEventoInfo(BaseModel):
    evento_id: str
    nome: str
    local: str
    data_inicio: str


@router.get("/evento", response_model=PortariaEventoInfo)
async def info_evento_portaria(
    request: Request,
    evento_id: str = Query(..., min_length=8),
    k: str = Query(..., min_length=8),
    db: Session = Depends(get_db),
    _rate: None = Depends(rate_limit_portaria_info),
):
    evento = evento_por_token_portaria(db, evento_id, k)
    if not evento:
        raise HTTPException(status_code=403, detail="Link da portaria inválido ou expirado.")
    return PortariaEventoInfo(
        evento_id=evento.id,
        nome=evento.nome,
        local=evento.local or "",
        data_inicio=evento.data_inicio.isoformat() if evento.data_inicio else "",
    )


@router.post("/validar")
async def validar_portaria(
    body: PortariaValidarRequest,
    db: Session = Depends(get_db),
    _rate: None = Depends(rate_limit_portaria_validar),
):
    evento = evento_por_token_portaria(db, body.evento_id, body.token)
    if not evento:
        raise HTTPException(status_code=403, detail="Link da portaria inválido.")
    try:
        return realizar_checkin_portaria(db, body.evento_id, body.codigo)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
