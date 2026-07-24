"""E-mail de marketing da plataforma (opt-in)."""

from __future__ import annotations

import logging
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from app.services.email_branding import build_email_html, get_email_branding, link_style
from app.services.smtp_client import format_from_header_branded, smtp_configured
from config.settings import settings

logger = logging.getLogger(__name__)


def enviar_email_marketing_sync(
    *,
    destino: str,
    nome: str,
    assunto: str,
    mensagem: str,
    link_preferencias: str,
) -> bool:
    branding = get_email_branding()
    corpo_html = mensagem.replace("\n", "<br/>")
    body = (
        f"<p>Olá, <strong>{nome}</strong>!</p>"
        f"<div>{corpo_html}</div>"
        f'<p style="font-size:12px;color:#71717a">'
        f"Você recebeu porque aceitou comunicações da {branding.site_name}. "
        f'<a href="{link_preferencias}" style="{link_style(branding)}">Alterar preferências</a>.'
        "</p>"
    )
    html = build_email_html(title=assunto[:200], body_html=body, branding=branding)

    msg = MIMEMultipart("alternative")
    msg["Subject"] = assunto[:200]
    msg["From"] = format_from_header_branded()
    msg["To"] = destino
    msg.attach(
        MIMEText(
            f"Olá, {nome}!\n\n{mensagem}\n\nPreferências: {link_preferencias}\n",
            "plain",
            "utf-8",
        )
    )
    msg.attach(MIMEText(html, "html", "utf-8"))

    if not smtp_configured():
        logger.info("Marketing e-mail → %s (SMTP não configurado; simulado OK)", destino)
        return True

    try:
        with smtplib.SMTP(settings.EMAIL_SERVER, settings.EMAIL_PORT, timeout=30) as server:
            if settings.EMAIL_USE_TLS:
                server.starttls()
            server.login(settings.EMAIL_USER, settings.EMAIL_PASSWORD)
            server.sendmail(settings.EMAIL_USER, [destino], msg.as_string())
        return True
    except Exception:
        logger.exception("Falha marketing e-mail → %s", destino)
        return False
