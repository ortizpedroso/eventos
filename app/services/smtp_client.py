"""Cliente SMTP compartilhado (verificação, ingresso, recuperação de senha, marketing)."""

from __future__ import annotations

import logging
import smtplib
import ssl
from contextlib import contextmanager
from email.message import EmailMessage
from email.utils import formataddr

from config.settings import settings

logger = logging.getLogger(__name__)


def smtp_configured() -> bool:
    return bool((settings.EMAIL_USER or "").strip() and (settings.EMAIL_PASSWORD or "").strip())


def smtp_use_ssl() -> bool:
    """Porta 465 usa SSL implícito; 587 usa STARTTLS (EMAIL_USE_TLS)."""
    if settings.EMAIL_USE_SSL:
        return True
    if settings.EMAIL_PORT == 465:
        return True
    return False


def format_from_header(site_name: str | None = None) -> str:
    name = (site_name or settings.EMAIL_FROM_NAME or "EventosBR").strip() or "EventosBR"
    user = (settings.EMAIL_USER or "").strip()
    return formataddr((name, user)) if user else name


def format_from_header_branded(db=None) -> str:
    from app.services.email_branding import get_email_branding

    branding = get_email_branding(db)
    return format_from_header(branding.site_name)


@contextmanager
def _smtp_session():
    """Abre conexão SMTP (STARTTLS na 587 ou SSL na 465)."""
    host = settings.EMAIL_SERVER
    port = settings.EMAIL_PORT
    timeout = 30
    use_ssl = smtp_use_ssl()

    if use_ssl:
        context = ssl.create_default_context()
        with smtplib.SMTP_SSL(host, port, timeout=timeout, context=context) as server:
            yield server
        return

    with smtplib.SMTP(host, port, timeout=timeout) as server:
        if settings.EMAIL_USE_TLS:
            server.starttls(context=ssl.create_default_context())
        yield server


def send_email(
    *,
    destino: str,
    assunto: str,
    corpo_texto: str,
    corpo_html: str | None = None,
    reply_to: str | None = None,
    db=None,
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
    msg["From"] = format_from_header_branded(db)
    msg["To"] = to
    reply = (reply_to or "").strip()
    if reply:
        msg["Reply-To"] = reply
    msg.set_content(corpo_texto)
    if corpo_html:
        msg.add_alternative(corpo_html, subtype="html")

    mode = "SSL" if smtp_use_ssl() else ("STARTTLS" if settings.EMAIL_USE_TLS else "plain")
    try:
        with _smtp_session() as server:
            server.login(settings.EMAIL_USER, settings.EMAIL_PASSWORD)
            server.send_message(msg)
        logger.info("E-mail enviado para %s (%s)", to, assunto)
        return True
    except Exception:
        logger.exception(
            "Falha ao enviar e-mail para %s (%s) via %s:%s modo=%s",
            to,
            assunto,
            settings.EMAIL_SERVER,
            settings.EMAIL_PORT,
            mode,
        )
        return False


def send_test_email(destino: str) -> bool:
    """E-mail de teste para validar SMTP (scripts e painel admin)."""
    from app.services.email_branding import build_email_html, format_email_subject, get_email_branding

    branding = get_email_branding()
    body = (
        "<p>Este é um e-mail de teste da plataforma.</p>"
        "<p>Se você recebeu esta mensagem, o SMTP está configurado corretamente.</p>"
    )
    html = build_email_html(title="Teste SMTP", body_html=body, branding=branding)
    return send_email(
        destino=destino,
        assunto=format_email_subject("Teste SMTP", branding),
        corpo_texto=(
            f"Este é um e-mail de teste da plataforma {branding.site_name}.\n\n"
            "Se você recebeu esta mensagem, o SMTP está configurado corretamente.\n\n"
            f"— {branding.site_name}"
        ),
        corpo_html=html,
    )
