"""E-mails de aviso e renovação da assinatura mensal."""

from __future__ import annotations

import logging
import smtplib
from datetime import datetime
from email.mime.text import MIMEText

from app.models import Usuario
from app.services.email_branding import build_email_html, format_email_subject, get_email_branding, link_style
from app.utils.html_escape import esc
from config.settings import settings

logger = logging.getLogger(__name__)

from app.services.smtp_client import format_from_header_branded, smtp_configured


def _financeiro_url() -> str:
    base = (settings.FRONTEND_PUBLIC_URL or "http://localhost:3000").rstrip("/")
    return f"{base}/organizador/financeiro"


def enviar_email_aviso_expiracao_assinatura(
    usuario: Usuario,
    *,
    dias_restantes: int,
    valida_ate: datetime,
) -> bool:
    if not smtp_configured():
        logger.warning("SMTP não configurado — aviso assinatura não enviado para %s", usuario.email)
        return False

    destino = (usuario.email or "").strip()
    if not destino:
        return False

    branding = get_email_branding()
    data_fmt = valida_ate.strftime("%d/%m/%Y")
    link = _financeiro_url()
    body = (
        f"<p>Olá, <strong>{esc(usuario.nome or '')}</strong>!</p>"
        f"<p>Sua assinatura com taxa reduzida por ingresso "
        f"{'expira hoje' if dias_restantes <= 0 else f'expira em {dias_restantes} dia(s)'} "
        f"({data_fmt}).</p>"
        f"<p>Para manter a taxa de assinatura, conclua a renovação no painel Financeiro.</p>"
        f'<p><a href="{link}" style="{link_style(branding)}">Abrir Financeiro</a></p>'
    )
    html = build_email_html(title=f"Sua assinatura {branding.site_name}", body_html=body, branding=branding)
    msg = MIMEText(html, "html", "utf-8")
    msg["Subject"] = format_email_subject(
        f"Assinatura — renovação em {max(dias_restantes, 0)} dia(s)",
        branding,
    )
    msg["From"] = format_from_header_branded()
    msg["To"] = destino

    try:
        with smtplib.SMTP(settings.EMAIL_SERVER, settings.EMAIL_PORT, timeout=30) as server:
            if settings.EMAIL_USE_TLS:
                server.starttls()
            server.login(settings.EMAIL_USER, settings.EMAIL_PASSWORD)
            server.sendmail(settings.EMAIL_USER, [destino], msg.as_string())
        return True
    except Exception:
        logger.exception("Falha ao enviar aviso de assinatura para %s", destino)
        return False


def enviar_email_renovacao_assinatura_gerada(usuario: Usuario, *, payment_id: str) -> bool:
    if not smtp_configured():
        return False

    destino = (usuario.email or "").strip()
    if not destino:
        return False

    branding = get_email_branding()
    link = _financeiro_url()
    body = (
        f"<p>Olá, <strong>{esc(usuario.nome or '')}</strong>!</p>"
        f"<p>Geramos a cobrança PIX da sua mensalidade. Acesse o Financeiro para pagar "
        f"e manter a taxa reduzida por ingresso.</p>"
        f'<p><a href="{link}" style="{link_style(branding)}">Pagar renovação no Financeiro</a></p>'
        f'<p style="font-size:11px;color:#71717a">Referência: {esc(payment_id)}</p>'
    )
    html = build_email_html(
        title=f"Renovação da assinatura {branding.site_name}",
        body_html=body,
        branding=branding,
    )
    msg = MIMEText(html, "html", "utf-8")
    msg["Subject"] = format_email_subject("Renovação da assinatura — PIX disponível", branding)
    msg["From"] = format_from_header_branded()
    msg["To"] = destino

    try:
        with smtplib.SMTP(settings.EMAIL_SERVER, settings.EMAIL_PORT, timeout=30) as server:
            if settings.EMAIL_USE_TLS:
                server.starttls()
            server.login(settings.EMAIL_USER, settings.EMAIL_PASSWORD)
            server.sendmail(settings.EMAIL_USER, [destino], msg.as_string())
        return True
    except Exception:
        logger.exception("Falha ao enviar e-mail de renovação assinatura para %s", destino)
        return False
