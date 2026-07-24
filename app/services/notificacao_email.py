"""E-mail transacional simples (fila em memória / Redis)."""

from __future__ import annotations

import logging
import smtplib
import threading
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from queue import Empty, Queue

from app.services.redis_conn import get_redis_optional
from app.services.smtp_client import format_from_header_branded, smtp_configured
from config.settings import settings

logger = logging.getLogger(__name__)

_REDIS_KEY = "eventosbr:q:email_simples"
_memory: Queue[str] = Queue()
_worker_lock = threading.Lock()
_worker_started = False


def _payload(destino: str, assunto: str, html: str) -> str:
    # separador improvável em e-mails
    return f"{destino}\x1e{assunto}\x1e{html}"


def _parse(payload: str) -> tuple[str, str, str]:
    parts = payload.split("\x1e", 2)
    if len(parts) != 3:
        return "", "", ""
    return parts[0], parts[1], parts[2]


def _send_sync(destino: str, assunto: str, html: str) -> bool:
    if not smtp_configured():
        logger.info("E-mail simples (SMTP off): %s — %s", destino, assunto)
        return True
    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = assunto
        msg["From"] = format_from_header_branded()
        msg["To"] = destino
        msg.attach(MIMEText(html, "html", "utf-8"))
        with smtplib.SMTP(settings.EMAIL_SERVER, settings.EMAIL_PORT, timeout=30) as smtp:
            if settings.EMAIL_USE_TLS:
                smtp.starttls()
            smtp.login(settings.EMAIL_USER, settings.EMAIL_PASSWORD)
            smtp.sendmail(settings.EMAIL_USER, [destino], msg.as_string())
        return True
    except Exception:
        logger.exception("Falha ao enviar e-mail simples para %s", destino)
        return False


def _worker_loop() -> None:
    r = get_redis_optional()
    while True:
        try:
            if r:
                item = r.blpop(_REDIS_KEY, timeout=5)
                payload = item[1].decode() if item else None
            else:
                payload = _memory.get(timeout=5)
        except Empty:
            continue
        except Exception:
            logger.exception("Worker e-mail simples")
            continue
        if not payload:
            continue
        destino, assunto, html = _parse(payload)
        if destino:
            _send_sync(destino, assunto, html)


def _ensure_worker() -> None:
    global _worker_started
    with _worker_lock:
        if _worker_started:
            return
        t = threading.Thread(target=_worker_loop, name="email-simples", daemon=True)
        t.start()
        _worker_started = True


def enqueue_email_simples(destino: str, assunto: str, html: str) -> bool:
    destino = destino.strip().lower()
    if not destino:
        return False
    _ensure_worker()
    payload = _payload(destino, assunto, html)
    r = get_redis_optional()
    if r and settings.TICKET_EMAIL_USE_REDIS:
        r.rpush(_REDIS_KEY, payload)
    else:
        _memory.put(payload)
    return True
