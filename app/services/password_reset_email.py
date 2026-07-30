"""E-mail de recuperação / primeiro acesso (definir senha)."""

from __future__ import annotations

import logging

from app.services.email_branding import build_email_html, format_email_subject, get_email_branding, link_style
from app.services.notificacao_email import enqueue_email_simples
from app.services.smtp_client import smtp_configured
from app.utils.html_escape import esc

logger = logging.getLogger(__name__)


def enviar_email_recuperacao_senha(
    *,
    destino: str,
    nome: str,
    link: str,
    primeiro_acesso: bool = False,
) -> bool:
    if not smtp_configured():
        logger.warning("SMTP não configurado — link de senha não enviado para %s", destino)
        return False

    branding = get_email_branding()
    if primeiro_acesso:
        titulo = "Definir senha de acesso"
        intro = (
            f"<p>Olá, <strong>{esc(nome or 'participante')}</strong>!</p>"
            f"<p>Sua conta {esc(branding.site_name)} foi criada na <strong>compra rápida</strong> "
            "sem senha. Para entrar depois e ver seus ingressos, defina uma senha neste link:</p>"
        )
        cta = "Definir minha senha"
        texto_plano = (
            f"Olá, {nome or 'participante'}!\n\n"
            f"Sua conta {branding.site_name} foi criada na compra rápida sem senha. "
            "Para entrar depois e ver seus ingressos, defina uma senha neste link "
            f"(válido por 1 hora):\n{link}\n\n"
            "Se você não solicitou, ignore este e-mail.\n\n"
            f"— {branding.site_name}"
        )
    else:
        titulo = "Recuperar senha"
        intro = (
            f"<p>Olá, <strong>{esc(nome or 'participante')}</strong>!</p>"
            f"<p>Recebemos um pedido para redefinir a senha da sua conta {esc(branding.site_name)}.</p>"
        )
        cta = "Redefinir senha"
        texto_plano = (
            f"Olá, {nome or 'participante'}!\n\n"
            f"Recebemos um pedido para redefinir a senha da sua conta {branding.site_name}.\n\n"
            f"Acesse o link abaixo (válido por 1 hora):\n{link}\n\n"
            "Se você não solicitou, ignore este e-mail.\n\n"
            f"— {branding.site_name}"
        )

    body = (
        f"{intro}"
        f'<p><a href="{link}" style="{link_style(branding)}">{cta}</a> (válido por 1 hora)</p>'
        "<p>Se você não solicitou, ignore este e-mail.</p>"
    )
    html = build_email_html(title=titulo, body_html=body, branding=branding)
    assunto = format_email_subject(titulo, branding)

    # Fila com retry (igual onboarding/saque) — evita falha silenciosa no request HTTP.
    ok = enqueue_email_simples(destino.strip().lower(), assunto, html)
    if ok:
        logger.info(
            "E-mail de %s enfileirado para %s",
            "primeiro acesso" if primeiro_acesso else "recuperação de senha",
            destino,
        )
    else:
        logger.error("Falha ao enfileirar e-mail de senha para %s", destino)
        # Fallback síncrono se a fila recusar (destino vazio etc.)
        from app.services.smtp_client import send_email

        return send_email(
            destino=destino,
            assunto=assunto,
            corpo_texto=texto_plano,
            corpo_html=html,
        )
    return ok
