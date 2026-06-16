"""E-mail de recuperação de senha."""

from __future__ import annotations

import logging

from app.services.smtp_client import send_email, smtp_configured

logger = logging.getLogger(__name__)


def enviar_email_recuperacao_senha(*, destino: str, nome: str, link: str) -> bool:
    if not smtp_configured():
        logger.warning("SMTP não configurado — link de recuperação não enviado para %s", destino)
        return False

    return send_email(
        destino=destino,
        assunto="Recuperar senha — EventosBR",
        corpo_texto=(
            f"Olá, {nome or 'participante'}!\n\n"
            f"Recebemos um pedido para redefinir a senha da sua conta EventosBR.\n\n"
            f"Acesse o link abaixo (válido por 1 hora):\n{link}\n\n"
            "Se você não solicitou, ignore este e-mail.\n\n"
            "— EventosBR"
        ),
    )
