"""Envio de ingresso por e-mail (SMTP) com fila em thread para não bloquear webhooks."""

from __future__ import annotations

import logging
import smtplib
import threading
from email.mime.image import MIMEImage
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from queue import Empty, Queue

from sqlalchemy.orm import Session, joinedload

from app.models import Ingresso
from app.services.ingresso_qr import gerar_qr_png_bytes, ingresso_qr_payload
from config.database import SessionLocal
from config.settings import settings

logger = logging.getLogger(__name__)

_queue: Queue[str] = Queue()
_worker_lock = threading.Lock()
_worker_started = False


def _smtp_configured() -> bool:
    return bool((settings.EMAIL_USER or "").strip() and (settings.EMAIL_PASSWORD or "").strip())


def _build_html(ingresso: Ingresso, qr_cid: str) -> str:
    evento = ingresso.evento
    valor_fmt = f"{ingresso.valor:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
    base = (settings.FRONTEND_PUBLIC_URL or "http://localhost:3000").rstrip("/")
    link = f"{base}/conta/ingressos/{ingresso.id}"
    return (
        '<div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#18181b">'
        f"<h2 style=\"color:#047857\">{evento.nome}</h2>"
        f"<p>Olá, <strong>{ingresso.participante_nome}</strong>!</p>"
        f"<p>Seu ingresso está confirmado. Apresente o QR Code na entrada.</p>"
        f"<p><strong>Data:</strong> {evento.data_inicio}<br/>"
        f"<strong>Local:</strong> {evento.local}<br/>"
        f"<strong>Valor:</strong> R$ {valor_fmt}</p>"
        f'<p style="text-align:center"><img src="cid:{qr_cid}" alt="QR Code" width="200" height="200"/></p>'
        f'<p style="font-size:12px;color:#71717a">Código: {ingresso.id}</p>'
        f'<p><a href="{link}" style="color:#047857">Ver ingresso na conta</a></p>'
        f'<p style="font-size:11px;color:#a1a1aa">Reembolso: até 10 dias em Minha conta → Pagamentos.</p>'
        "</div>"
    )


def _send_sync(ingresso_id: str) -> bool:
    db: Session = SessionLocal()
    try:
        ingresso = (
            db.query(Ingresso)
            .options(joinedload(Ingresso.evento))
            .filter(Ingresso.id == ingresso_id, Ingresso.status == "pago")
            .first()
        )
        if not ingresso:
            logger.warning("E-mail ingresso: %s não encontrado ou não pago", ingresso_id)
            return False

        destino = (ingresso.participante_email or "").strip()
        if not destino:
            logger.warning("E-mail ingresso %s: sem destino", ingresso_id)
            return False

        qr_bytes = gerar_qr_png_bytes(ingresso.id)
        qr_cid = "ingresso_qr"
        html = _build_html(ingresso, qr_cid)

        msg = MIMEMultipart("related")
        msg["Subject"] = f"Seu ingresso — {ingresso.evento.nome}"
        msg["From"] = f"{settings.EMAIL_FROM_NAME} <{settings.EMAIL_USER}>"
        msg["To"] = destino

        alt = MIMEMultipart("alternative")
        alt.attach(
            MIMEText(
                f"Ingresso: {ingresso.evento.nome}\n"
                f"Participante: {ingresso.participante_nome}\n"
                f"QR: {ingresso_qr_payload(ingresso.id)}",
                "plain",
                "utf-8",
            )
        )
        alt.attach(MIMEText(html, "html", "utf-8"))
        msg.attach(alt)

        img = MIMEImage(qr_bytes, _subtype="png")
        img.add_header("Content-ID", f"<{qr_cid}>")
        img.add_header("Content-Disposition", "inline", filename="ingresso-qr.png")
        msg.attach(img)

        if not _smtp_configured():
            logger.info(
                "E-mail ingresso %s → %s (SMTP não configurado; conteúdo gerado, não enviado)",
                ingresso_id,
                destino,
            )
            return True

        with smtplib.SMTP(settings.EMAIL_SERVER, settings.EMAIL_PORT, timeout=30) as server:
            server.starttls()
            server.login(settings.EMAIL_USER, settings.EMAIL_PASSWORD)
            server.sendmail(settings.EMAIL_USER, [destino], msg.as_string())

        logger.info("E-mail ingresso enviado: %s → %s", ingresso_id, destino)
        return True
    except Exception:
        logger.exception("Falha ao enviar e-mail do ingresso %s", ingresso_id)
        return False
    finally:
        db.close()


def _worker_loop() -> None:
    while True:
        try:
            ingresso_id = _queue.get(timeout=2.0)
        except Empty:
            continue
        try:
            _send_sync(ingresso_id)
        finally:
            _queue.task_done()


def _ensure_worker() -> None:
    global _worker_started
    with _worker_lock:
        if _worker_started:
            return
        t = threading.Thread(target=_worker_loop, name="ticket-email-worker", daemon=True)
        t.start()
        _worker_started = True


def enqueue_ticket_email(ingresso_id: str) -> None:
    """Enfileira envio assíncrono (não bloqueia request/webhook)."""
    _ensure_worker()
    _queue.put(ingresso_id)


def _send_comunicado_sync(evento_id: str, assunto: str, mensagem: str) -> int:
    db: Session = SessionLocal()
    enviados = 0
    try:
        ingressos = (
            db.query(Ingresso)
            .options(joinedload(Ingresso.evento))
            .filter(
                Ingresso.evento_id == evento_id,
                Ingresso.status.in_(("pago", "usado")),
            )
            .all()
        )
        vistos: set[str] = set()
        base = (settings.FRONTEND_PUBLIC_URL or "http://localhost:3000").rstrip("/")

        for ing in ingressos:
            destino = (ing.participante_email or "").strip()
            key = destino.lower()
            if not destino or key in vistos:
                continue
            vistos.add(key)

            corpo = mensagem.replace("\n", "<br/>")
            html = (
                '<div style="font-family:sans-serif;max-width:560px;color:#18181b">'
                f"<h2 style=\"color:#047857\">{ing.evento.nome}</h2>"
                f"<p>Olá, <strong>{ing.participante_nome or 'participante'}</strong>!</p>"
                f"<div style=\"margin:16px 0;line-height:1.5\">{corpo}</div>"
                f'<p><a href="{base}/conta/ingressos/{ing.id}" style="color:#047857">Ver meu ingresso</a></p>'
                f'<p style="font-size:11px;color:#a1a1aa">Mensagem enviada pelo organizador do evento.</p>'
                "</div>"
            )

            msg = MIMEMultipart("alternative")
            msg["Subject"] = assunto[:200]
            msg["From"] = f"{settings.EMAIL_FROM_NAME} <{settings.EMAIL_USER}>"
            msg["To"] = destino
            msg.attach(MIMEText(mensagem, "plain", "utf-8"))
            msg.attach(MIMEText(html, "html", "utf-8"))

            if not _smtp_configured():
                enviados += 1
                continue
            try:
                with smtplib.SMTP(settings.EMAIL_SERVER, settings.EMAIL_PORT, timeout=30) as server:
                    server.starttls()
                    server.login(settings.EMAIL_USER, settings.EMAIL_PASSWORD)
                    server.sendmail(settings.EMAIL_USER, [destino], msg.as_string())
                enviados += 1
            except Exception:
                logger.exception("Falha comunicado → %s", destino)
        return enviados
    finally:
        db.close()


_comunicado_queue: Queue[tuple[str, str, str]] = Queue()


def _comunicado_worker() -> None:
    while True:
        try:
            item = _comunicado_queue.get(timeout=2.0)
        except Empty:
            continue
        try:
            _send_comunicado_sync(*item)
        finally:
            _comunicado_queue.task_done()


_comunicado_worker_started = False


def enqueue_comunicado_evento(evento_id: str, assunto: str, mensagem: str) -> int:
    global _comunicado_worker_started
    with _worker_lock:
        if not _comunicado_worker_started:
            threading.Thread(
                target=_comunicado_worker,
                name="comunicado-email-worker",
                daemon=True,
            ).start()
            _comunicado_worker_started = True
    _comunicado_queue.put((evento_id, assunto, mensagem))
    db: Session = SessionLocal()
    try:
        n = (
            db.query(Ingresso)
            .filter(
                Ingresso.evento_id == evento_id,
                Ingresso.status.in_(("pago", "usado")),
                Ingresso.participante_email.isnot(None),
            )
            .count()
        )
        return n
    finally:
        db.close()
