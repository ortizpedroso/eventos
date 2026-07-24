"""E-mail de confirmação de propriedade do endereço (compra rápida e reenvio)."""

from __future__ import annotations

import logging
import secrets
from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from app.models import Usuario
from app.services.email_branding import build_email_html, format_email_subject, get_email_branding, link_style
from app.services.smtp_client import send_email, smtp_configured
from app.utils.html_escape import esc
from config.settings import settings

logger = logging.getLogger(__name__)

VERIFICACAO_VALIDADE_HORAS = 48


def _link_verificacao(token: str) -> str:
    base = (settings.FRONTEND_PUBLIC_URL or "http://localhost:3000").rstrip("/")
    return f"{base}/auth/verificar-email?token={token}"


def gerar_token_verificacao() -> str:
    return secrets.token_urlsafe(32)


def preparar_verificacao_email(usuario: Usuario) -> str:
    """Define token de verificação e marca e-mail como não confirmado."""
    token = gerar_token_verificacao()
    usuario.email_verificacao_token = token
    usuario.email_verificacao_expires = datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(
        hours=VERIFICACAO_VALIDADE_HORAS
    )
    usuario.email_verificado = False
    return token


def enviar_email_verificacao(*, destino: str, nome: str, link: str) -> bool:
    if not smtp_configured():
        logger.warning(
            "SMTP não configurado — link de verificação não enviado para %s (dev: %s)",
            destino,
            link,
        )
        return False

    branding = get_email_branding()
    body = (
        f"<p>Olá, <strong>{esc(nome or 'participante')}</strong>!</p>"
        f"<p>Confirme que este e-mail é seu para proteger sua conta e ingressos na {esc(branding.site_name)}.</p>"
        f'<p><a href="{link}" style="{link_style(branding)}">Confirmar e-mail</a> '
        f"(válido por {VERIFICACAO_VALIDADE_HORAS} horas)</p>"
        "<p>Se você não fez uma compra conosco, ignore este e-mail.</p>"
    )
    html = build_email_html(title="Confirme seu e-mail", body_html=body, branding=branding)

    return send_email(
        destino=destino,
        assunto=format_email_subject("Confirme seu e-mail", branding),
        corpo_texto=(
            f"Olá, {nome or 'participante'}!\n\n"
            f"Confirme que este e-mail é seu para proteger sua conta e ingressos na {branding.site_name}.\n\n"
            f"Link (válido por {VERIFICACAO_VALIDADE_HORAS} horas):\n{link}\n\n"
            "Se você não fez uma compra conosco, ignore este e-mail.\n\n"
            f"— {branding.site_name}"
        ),
        corpo_html=html,
    )


def disparar_verificacao_compra_rapida(db: Session, usuario: Usuario) -> bool:
    """Gera token e envia e-mail após compra rápida (conta sem senha)."""
    if usuario.email_verificado:
        return True
    token = preparar_verificacao_email(usuario)
    db.commit()
    link = _link_verificacao(token)
    return enviar_email_verificacao(destino=usuario.email, nome=usuario.nome, link=link)


def confirmar_email_por_token(db: Session, token: str) -> Usuario | None:
    tok = (token or "").strip()
    if not tok:
        return None
    agora = datetime.now(timezone.utc).replace(tzinfo=None)
    usuario = (
        db.query(Usuario)
        .filter(Usuario.email_verificacao_token == tok)
        .first()
    )
    if not usuario:
        return None
    if not usuario.email_verificacao_expires or usuario.email_verificacao_expires < agora:
        return None
    usuario.email_verificado = True
    usuario.email_verificacao_token = None
    usuario.email_verificacao_expires = None
    db.commit()
    db.refresh(usuario)
    return usuario
