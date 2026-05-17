"""Check-in de ingressos na portaria (organizador)."""

from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.models import Usuario, get_db
from app.routes.auth import get_usuario_atual
from app.services.ingresso_checkin import realizar_checkin

logger = logging.getLogger(__name__)
router = APIRouter()


class CheckinRequest(BaseModel):
    codigo: str = Field(min_length=4, max_length=500)


def _require_organizador(usuario: Usuario) -> None:
    if usuario.tipo != "organizador":
        raise HTTPException(status_code=403, detail="Apenas organizadores podem validar ingressos")


@router.post("/validar")
async def validar_checkin(
    body: CheckinRequest,
    usuario_atual: Usuario = Depends(get_usuario_atual),
    db: Session = Depends(get_db),
):
    _require_organizador(usuario_atual)
    try:
        return realizar_checkin(db, usuario_atual, body.codigo)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
