"""Cliente SMTP compartilhado (verificação, ingresso, recuperação de senha, marketing)."""

from __future__ import annotations

import logging
import smtplib
from email.message import EmailMessage
from email.utils import formataddr

from config.settings import settings

logger = logging.getLogger(__name__)


def smtp_configured() -> bool:
    return bool((settings.EMAIL_USER or "").strip() and (settings.EMAIL_PASSWORD or "").strip())


def format_from_header() -> str:
    name = (settings.EMAIL_FROM_NAME or "EventosBR").strip() or "EventosBR"
    user = (settings.EMAIL_USER or "").strip()
    return formataddr((name, user)) if user else name


def send_email(
    *,
    destino: str,
    assunto: str,
    corpo_texto: str,
    corpo_html: str | None = None,
) -> bool:
    """Envia e-mail transacional. Retorna False se SMTP não estiver configurado."""
    to = (destino or "").strip()
    if not to:
        return False
    if not smtp_configured():
        logger.warning("SMTP não configurado — e-mail não enviado para %s", to)
        return False

    msg = EmailMessage()
    msg["Subject"] = assunto
    msg["From"] = format_from_header()
    msg["To"] = to
    msg.set_content(corpo_texto)
    if corpo_html:
        msg.add_alternative(corpo_html, subtype="html")

    try:
        with smtplib.SMTP(settings.EMAIL_SERVER, settings.EMAIL_PORT, timeout=30) as server:
            if settings.EMAIL_USE_TLS:
                server.starttls()
            server.login(settings.EMAIL_USER, settings.EMAIL_PASSWORD)
            server.send_message(msg)
        logger.info("E-mail enviado para %s (%s)", to, assunto)
        return True
    except Exception:
        logger.exception("Falha ao enviar e-mail para %s (%s)", to, assunto)
        return False


def send_test_email(destino: str) -> bool:
    """E-mail de teste para validar SMTP (scripts e painel admin)."""
    return send_email(
        destino=destino,
        assunto="Teste SMTP — EventosBR",
        corpo_texto=(
            "Este é um e-mail de teste da plataforma EventosBR.\n\n"
            "Se você recebeu esta mensagem, o SMTP está configurado corretamente.\n\n"
            "— EventosBR"
        ),
    )
