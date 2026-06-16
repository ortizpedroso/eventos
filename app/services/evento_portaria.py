"""Link secreto da portaria para validação de ingressos por colaboradores."""

from __future__ import annotations

import secrets
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.models import Evento
from config.settings import settings


def gerar_checkin_token() -> str:
    return secrets.token_urlsafe(24)


def _agora_utc_naive() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _definir_token(evento: Evento, token: str) -> None:
    evento.checkin_token = token
    evento.checkin_token_em = _agora_utc_naive()


def rotacionar_token_se_necessario(db: Session, evento: Evento) -> bool:
    """
    Rotação automática do link da portaria:
    - token com mais de PORTARIA_TOKEN_MAX_AGE_DAYS dias, ou
    - evento começa em até PORTARIA_TOKEN_ROTATE_BEFORE_EVENT_DAYS dias e token tem >7 dias.
  """
    token = (evento.checkin_token or "").strip()
    if not token:
        return False

    agora = _agora_utc_naive()
    token_em = evento.checkin_token_em or evento.data_criacao or agora
    idade_dias = (agora - token_em).days

    rotacionar = idade_dias >= settings.PORTARIA_TOKEN_MAX_AGE_DAYS

    if not rotacionar and evento.data_inicio:
        delta_horas = (evento.data_inicio - agora).total_seconds() / 3600
        if 0 < delta_horas <= settings.PORTARIA_TOKEN_ROTATE_BEFORE_EVENT_DAYS * 24 and idade_dias >= 7:
            rotacionar = True

    if not rotacionar:
        return False

    novo = gerar_checkin_token()
    while db.query(Evento).filter(Evento.checkin_token == novo).first():
        novo = gerar_checkin_token()
    _definir_token(evento, novo)
    db.commit()
    db.refresh(evento)
    return True


def garantir_checkin_token(db: Session, evento: Evento) -> str:
    rotacionar_token_se_necessario(db, evento)
    token = (evento.checkin_token or "").strip()
    if token:
        if not evento.checkin_token_em:
            evento.checkin_token_em = _agora_utc_naive()
            db.commit()
            db.refresh(evento)
        return token
    token = gerar_checkin_token()
    while db.query(Evento).filter(Evento.checkin_token == token).first():
        token = gerar_checkin_token()
    _definir_token(evento, token)
    db.commit()
    db.refresh(evento)
    return token


def regenerar_checkin_token(db: Session, evento: Evento) -> str:
    """Gera novo token (ação manual do organizador)."""
    token = gerar_checkin_token()
    while db.query(Evento).filter(Evento.checkin_token == token).first():
        token = gerar_checkin_token()
    _definir_token(evento, token)
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
