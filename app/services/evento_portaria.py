"""Link secreto da portaria para validação de ingressos por colaboradores."""

from __future__ import annotations

import secrets

from sqlalchemy.orm import Session

from app.models import Evento
from config.settings import settings


def gerar_checkin_token() -> str:
    return secrets.token_urlsafe(24)


def garantir_checkin_token(db: Session, evento: Evento) -> str:
    token = (evento.checkin_token or "").strip()
    if token:
        return token
    token = gerar_checkin_token()
    while db.query(Evento).filter(Evento.checkin_token == token).first():
        token = gerar_checkin_token()
    evento.checkin_token = token
    db.commit()
    db.refresh(evento)
    return token


def url_portaria(evento_id: str, token: str) -> str:
    base = (settings.FRONTEND_PUBLIC_URL or "http://localhost:3000").rstrip("/")
    tok = (token or "").strip()
    return f"{base}/portaria/{evento_id}/{tok}"


def evento_por_token_portaria(db: Session, evento_id: str, token: str) -> Evento | None:
    tok = (token or "").strip()
    if not tok:
        return None
    evento = db.query(Evento).filter(Evento.id == evento_id).first()
    if not evento or not evento.checkin_token:
        return None
    if secrets.compare_digest(evento.checkin_token, tok):
        return evento
    return None
