"""E-mail de recuperação de senha."""

from __future__ import annotations

import logging

from app.services.email_branding import build_email_html, format_email_subject, get_email_branding, link_style
from app.services.smtp_client import send_email, smtp_configured
from app.utils.html_escape import esc

logger = logging.getLogger(__name__)


def enviar_email_recuperacao_senha(*, destino: str, nome: str, link: str) -> bool:
    if not smtp_configured():
        logger.warning("SMTP não configurado — link de recuperação não enviado para %s", destino)
        return False

    branding = get_email_branding()
    body = (
        f"<p>Olá, <strong>{esc(nome or 'participante')}</strong>!</p>"
        f"<p>Recebemos um pedido para redefinir a senha da sua conta {esc(branding.site_name)}.</p>"
        f'<p><a href="{link}" style="{link_style(branding)}">Redefinir senha</a> (válido por 1 hora)</p>'
        "<p>Se você não solicitou, ignore este e-mail.</p>"
    )
    html = build_email_html(title="Recuperar senha", body_html=body, branding=branding)

    return send_email(
        destino=destino,
        assunto=format_email_subject("Recuperar senha", branding),
        corpo_texto=(
            f"Olá, {nome or 'participante'}!\n\n"
            f"Recebemos um pedido para redefinir a senha da sua conta {branding.site_name}.\n\n"
            f"Acesse o link abaixo (válido por 1 hora):\n{link}\n\n"
            "Se você não solicitou, ignore este e-mail.\n\n"
            f"— {branding.site_name}"
        ),
        corpo_html=html,
    )
