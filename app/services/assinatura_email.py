"""E-mails de aviso e renovação da assinatura mensal EventosBR."""

from __future__ import annotations

import logging
import smtplib
from datetime import datetime
from email.mime.text import MIMEText

from app.models import Usuario
from app.utils.html_escape import esc
from config.settings import settings

logger = logging.getLogger(__name__)

from app.services.smtp_client import format_from_header, smtp_configured


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

    data_fmt = valida_ate.strftime("%d/%m/%Y")
    link = _financeiro_url()
    html = (
        '<div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#18181b">'
        f"<h2 style=\"color:#047857\">Sua assinatura EventosBR</h2>"
        f"<p>Olá, <strong>{esc(usuario.nome or '')}</strong>!</p>"
        f"<p>Sua assinatura com taxa reduzida por ingresso "
        f"{'expira hoje' if dias_restantes <= 0 else f'expira em {dias_restantes} dia(s)'} "
        f"({data_fmt}).</p>"
        f"<p>Para manter a taxa de assinatura, conclua a renovação no painel Financeiro.</p>"
        f'<p><a href="{link}" style="color:#047857">Abrir Financeiro</a></p>'
        f'<p style="font-size:11px;color:#a1a1aa">EventosBR — eventosbr.app.br</p>'
        "</div>"
    )
    msg = MIMEText(html, "html", "utf-8")
    msg["Subject"] = f"Assinatura EventosBR — renovação em {max(dias_restantes, 0)} dia(s)"
    msg["From"] = format_from_header()
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

    link = _financeiro_url()
    html = (
        '<div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#18181b">'
        f"<h2 style=\"color:#047857\">Renovação da assinatura EventosBR</h2>"
        f"<p>Olá, <strong>{esc(usuario.nome or '')}</strong>!</p>"
        f"<p>Geramos a cobrança PIX da sua mensalidade. Acesse o Financeiro para pagar "
        f"e manter a taxa reduzida por ingresso.</p>"
        f'<p><a href="{link}" style="color:#047857">Pagar renovação no Financeiro</a></p>'
        f'<p style="font-size:11px;color:#71717a">Referência: {esc(payment_id)}</p>'
        "</div>"
    )
    msg = MIMEText(html, "html", "utf-8")
    msg["Subject"] = "Renovação da assinatura EventosBR — PIX disponível"
    msg["From"] = format_from_header()
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
