"""Lembrete por e-mail ~24h antes do evento."""

from __future__ import annotations

import logging
import smtplib
import threading
from datetime import datetime, timedelta, timezone
from email.mime.text import MIMEText

from sqlalchemy.orm import Session, joinedload

from app.models import Ingresso
from app.utils.html_escape import esc
from config.database import SessionLocal
from config.settings import settings

logger = logging.getLogger(__name__)

_INTERVALO_SEGUNDOS = 3600
_stop_event = threading.Event()
_thread: threading.Thread | None = None


def _smtp_configured() -> bool:
    return bool((settings.EMAIL_USER or "").strip() and (settings.EMAIL_PASSWORD or "").strip())


def _build_html(ingresso: Ingresso) -> str:
    evento = ingresso.evento
    base = (settings.FRONTEND_PUBLIC_URL or "http://localhost:3000").rstrip("/")
    link = f"{base}/conta/ingressos/{ingresso.id}"
    return (
        '<div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#18181b">'
        f"<h2 style=\"color:#047857\">Amanhã: {esc(evento.nome)}</h2>"
        f"<p>Olá, <strong>{esc(ingresso.participante_nome or '')}</strong>!</p>"
        f"<p>Este é um lembrete do seu ingresso. O evento começa em breve.</p>"
        f"<p><strong>Data:</strong> {evento.data_inicio}<br/>"
        f"<strong>Local:</strong> {esc(evento.local)}</p>"
        f'<p><a href="{link}" style="color:#047857">Abrir ingresso com QR Code</a></p>'
        "</div>"
    )


def _enviar_lembrete(ingresso: Ingresso) -> bool:
    destino = (ingresso.participante_email or "").strip()
    if not destino:
        return False
    msg = MIMEText(_build_html(ingresso), "html", "utf-8")
    msg["Subject"] = f"Lembrete: {ingresso.evento.nome} é amanhã"
    msg["From"] = settings.EMAIL_USER
    msg["To"] = destino
    with smtplib.SMTP(settings.EMAIL_HOST, settings.EMAIL_PORT) as server:
        if settings.EMAIL_USE_TLS:
            server.starttls()
        server.login(settings.EMAIL_USER, settings.EMAIL_PASSWORD)
        server.sendmail(settings.EMAIL_USER, [destino], msg.as_string())
    return True


def enviar_lembretes_pendentes() -> int:
    """Envia lembretes para ingressos pagos cujo evento começa em ~24h."""
    if not _smtp_configured():
        return 0

    agora = datetime.now(timezone.utc).replace(tzinfo=None)
    janela_inicio = agora + timedelta(hours=23)
    janela_fim = agora + timedelta(hours=25)

    db: Session = SessionLocal()
    enviados = 0
    try:
        candidatos = (
            db.query(Ingresso)
            .options(joinedload(Ingresso.evento))
            .join(Ingresso.evento)
            .filter(
                Ingresso.status == "pago",
                Ingresso.lembrete_enviado_em.is_(None),
            )
            .all()
        )
        for ing in candidatos:
            inicio = ing.evento.data_inicio
            if inicio is None or not (janela_inicio <= inicio <= janela_fim):
                continue
            try:
                if _enviar_lembrete(ing):
                    ing.lembrete_enviado_em = agora
                    enviados += 1
            except Exception:
                logger.exception("Falha ao enviar lembrete ingresso %s", ing.id)
        if enviados:
            db.commit()
        return enviados
    except Exception:
        db.rollback()
        logger.exception("Erro no job de lembretes")
        return 0
    finally:
        db.close()


def _worker() -> None:
    logger.info("Worker de lembretes iniciado (intervalo: %ds)", _INTERVALO_SEGUNDOS)
    while not _stop_event.is_set():
        try:
            n = enviar_lembretes_pendentes()
            if n:
                logger.info("Lembretes enviados: %d", n)
        except Exception:
            logger.exception("Erro inesperado no worker de lembretes")
        _stop_event.wait(_INTERVALO_SEGUNDOS)


def start_lembrete_worker() -> None:
    global _thread
    if _thread and _thread.is_alive():
        return
    _stop_event.clear()
    _thread = threading.Thread(target=_worker, name="lembrete-evento-worker", daemon=True)
    _thread.start()


def stop_lembrete_worker() -> None:
    _stop_event.set()
    if _thread:
        _thread.join(timeout=10)
