"""E-mail de recuperação de senha."""

from __future__ import annotations

import logging
import smtplib
from email.message import EmailMessage

from config.settings import settings

logger = logging.getLogger(__name__)


def _smtp_configured() -> bool:
    return bool((settings.EMAIL_USER or "").strip() and (settings.EMAIL_PASSWORD or "").strip())


def enviar_email_recuperacao_senha(*, destino: str, nome: str, link: str) -> bool:
    if not _smtp_configured():
        logger.warning("SMTP não configurado — link de recuperação não enviado para %s", destino)
        return False

    msg = EmailMessage()
    msg["Subject"] = "Recuperar senha — EventosBR"
    msg["From"] = settings.EMAIL_USER
    msg["To"] = destino
    msg.set_content(
        f"Olá, {nome or 'participante'}!\n\n"
        f"Recebemos um pedido para redefinir a senha da sua conta EventosBR.\n\n"
        f"Acesse o link abaixo (válido por 1 hora):\n{link}\n\n"
        "Se você não solicitou, ignore este e-mail.\n\n"
        "— EventosBR"
    )

    try:
        with smtplib.SMTP(settings.EMAIL_SERVER, settings.EMAIL_PORT, timeout=30) as server:
            server.starttls()
            server.login(settings.EMAIL_USER, settings.EMAIL_PASSWORD)
            server.send_message(msg)
        logger.info("E-mail de recuperação enviado para %s", destino)
        return True
    except Exception:
        logger.exception("Falha ao enviar e-mail de recuperação para %s", destino)
        return False
