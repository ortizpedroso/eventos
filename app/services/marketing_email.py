"""E-mail de marketing da plataforma (opt-in)."""

from __future__ import annotations

import logging
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from config.settings import settings

logger = logging.getLogger(__name__)


def _smtp_configured() -> bool:
    return bool((settings.EMAIL_USER or "").strip() and (settings.EMAIL_PASSWORD or "").strip())


def enviar_email_marketing_sync(
    *,
    destino: str,
    nome: str,
    assunto: str,
    mensagem: str,
    link_preferencias: str,
) -> bool:
    corpo_html = mensagem.replace("\n", "<br/>")
    html = (
        '<div style="font-family:sans-serif;max-width:560px;color:#18181b">'
        f"<p>Olá, <strong>{nome}</strong>!</p>"
        f'<div>{corpo_html}</div>'
        f'<p style="font-size:12px;color:#71717a">'
        f"Você recebeu porque aceitou comunicações da EventosBR. "
        f'<a href="{link_preferencias}" style="color:#047857">Alterar preferências</a>.'
        "</p>"
        "</div>"
    )

    msg = MIMEMultipart("alternative")
    msg["Subject"] = assunto[:200]
    msg["From"] = f"{settings.EMAIL_FROM_NAME} <{settings.EMAIL_USER}>"
    msg["To"] = destino
    msg.attach(
        MIMEText(
            f"Olá, {nome}!\n\n{mensagem}\n\nPreferências: {link_preferencias}\n",
            "plain",
            "utf-8",
        )
    )
    msg.attach(MIMEText(html, "html", "utf-8"))

    if not _smtp_configured():
        logger.info("Marketing e-mail → %s (SMTP não configurado; simulado OK)", destino)
        return True

    try:
        with smtplib.SMTP(settings.EMAIL_SERVER, settings.EMAIL_PORT, timeout=30) as server:
            server.starttls()
            server.login(settings.EMAIL_USER, settings.EMAIL_PASSWORD)
            server.sendmail(settings.EMAIL_USER, [destino], msg.as_string())
        return True
    except Exception:
        logger.exception("Falha marketing e-mail → %s", destino)
        return False
