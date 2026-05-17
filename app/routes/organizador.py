"""Ferramentas do organizador: comunicados em massa."""

from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session, joinedload

from app.models import Evento, Ingresso, Usuario, get_db
from app.routes.auth import get_usuario_atual
from app.services.ticket_email import enqueue_comunicado_evento

logger = logging.getLogger(__name__)
router = APIRouter()


class ComunicadoRequest(BaseModel):
    evento_id: str
    assunto: str = Field(min_length=3, max_length=200)
    mensagem: str = Field(min_length=10, max_length=8000)


def _require_organizador(usuario: Usuario) -> None:
    if usuario.tipo != "organizador":
        raise HTTPException(status_code=403, detail="Apenas organizadores podem enviar comunicados")


@router.post("/comunicados")
async def enviar_comunicado(
    body: ComunicadoRequest,
    usuario_atual: Usuario = Depends(get_usuario_atual),
    db: Session = Depends(get_db),
):
    """Envia e-mail para participantes com ingresso pago ou já utilizado."""
    _require_organizador(usuario_atual)

    evento = db.get(Evento, body.evento_id)
    if not evento or evento.organizador_id != usuario_atual.id:
        raise HTTPException(status_code=404, detail="Evento não encontrado")

    ingressos = (
        db.query(Ingresso)
        .options(joinedload(Ingresso.evento))
        .filter(
            Ingresso.evento_id == evento.id,
            Ingresso.status.in_(("pago", "usado")),
        )
        .all()
    )
    destinos = {
        (ing.participante_email or "").strip().lower()
        for ing in ingressos
        if (ing.participante_email or "").strip()
    }
    if not destinos:
        raise HTTPException(
            status_code=400,
            detail="Não há participantes com e-mail para este evento (ingressos pagos).",
        )

    enfileirados = enqueue_comunicado_evento(
        evento.id,
        body.assunto.strip(),
        body.mensagem.strip(),
    )
    logger.info(
        "Comunicado evento %s: %s destinos, fila=%s",
        evento.id,
        len(destinos),
        enfileirados,
    )
    return {
        "ok": True,
        "destinatarios": len(destinos),
        "enfileirados": enfileirados,
        "mensagem": "Comunicado enfileirado para envio. Verifique SMTP se os e-mails não chegarem.",
    }
