"""Cliente SMTP compartilhado (verificação, ingresso, recuperação de senha, marketing)."""

from __future__ import annotations

import logging
import smtplib
import ssl
from contextlib import contextmanager
from dataclasses import dataclass
from email.message import EmailMessage, Message
from email.utils import formataddr
from typing import Iterator

from config.settings import settings

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class _SmtpMode:
    port: int
    use_ssl: bool
    use_tls: bool
    label: str


def smtp_configured() -> bool:
    return bool((settings.EMAIL_USER or "").strip() and (settings.EMAIL_PASSWORD or "").strip())


def smtp_use_ssl() -> bool:
    """Porta 465 usa SSL implícito; 587 usa STARTTLS (EMAIL_USE_TLS)."""
    if settings.EMAIL_USE_SSL:
        return True
    if settings.EMAIL_PORT == 465:
        return True
    return False


def _configured_mode() -> _SmtpMode:
    return _SmtpMode(
        port=int(settings.EMAIL_PORT),
        use_ssl=smtp_use_ssl(),
        use_tls=bool(settings.EMAIL_USE_TLS) and not smtp_use_ssl(),
        label="configurado",
    )


def _smtp_modes() -> list[_SmtpMode]:
    """Ordem: configuração do .env, depois fallbacks Hostinger comuns."""
    modes: list[_SmtpMode] = []
    seen: set[tuple[int, bool, bool]] = set()

    def add(mode: _SmtpMode) -> None:
        key = (mode.port, mode.use_ssl, mode.use_tls)
        if key not in seen:
            seen.add(key)
            modes.append(mode)

    add(_configured_mode())
    add(_SmtpMode(port=465, use_ssl=True, use_tls=False, label="fallback-465-ssl"))
    add(_SmtpMode(port=587, use_ssl=False, use_tls=True, label="fallback-587-starttls"))
    return modes


def format_from_header(site_name: str | None = None) -> str:
    name = (site_name or settings.EMAIL_FROM_NAME or "EventosBR").strip() or "EventosBR"
    user = (settings.EMAIL_USER or "").strip()
    return formataddr((name, user)) if user else name


def format_from_header_branded(db=None) -> str:
    from app.services.email_branding import get_email_branding

    branding = get_email_branding(db)
    return format_from_header(branding.site_name)


@contextmanager
def _smtp_session(mode: _SmtpMode) -> Iterator[smtplib.SMTP]:
    host = settings.EMAIL_SERVER
    timeout = 30
    if mode.use_ssl:
        context = ssl.create_default_context()
        with smtplib.SMTP_SSL(host, mode.port, timeout=timeout, context=context) as server:
            yield server
        return

    with smtplib.SMTP(host, mode.port, timeout=timeout) as server:
        if mode.use_tls:
            server.starttls(context=ssl.create_default_context())
        yield server


def _deliver(msg: Message, *, to: str, assunto: str) -> bool:
    """Percorre os modos de conexão SMTP (configurado + fallbacks SSL/STARTTLS)
    até um funcionar. Compartilhado por `send_email()` e `send_prebuilt_message()`
    — mesma lógica de resiliência (porta 465 Hostinger etc.) para qualquer
    mensagem MIME, incluindo as com anexos/imagens inline."""
    last_error: Exception | None = None
    for mode in _smtp_modes():
        try:
            with _smtp_session(mode) as server:
                server.login(settings.EMAIL_USER, settings.EMAIL_PASSWORD)
                server.send_message(msg)
            if mode.label != "configurado":
                logger.warning(
                    "E-mail enviado via modo %s (%s:%s) — ajuste EMAIL_PORT/EMAIL_USE_SSL no .env",
                    mode.label,
                    settings.EMAIL_SERVER,
                    mode.port,
                )
            logger.info("E-mail enviado para %s (%s)", to, assunto)
            return True
        except Exception as exc:
            last_error = exc
            logger.warning(
                "Falha SMTP modo=%s host=%s port=%s: %s",
                mode.label,
                settings.EMAIL_SERVER,
                mode.port,
                exc,
            )

    logger.exception(
        "Falha ao enviar e-mail para %s (%s) após tentar todos os modos SMTP",
        to,
        assunto,
        exc_info=last_error,
    )
    return False


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

    return _deliver(msg, to=to, assunto=assunto)


def send_prebuilt_message(msg: Message, *, destino: str) -> bool:
    """Envia uma mensagem MIME já montada pelo chamador (ex: `MIMEMultipart` com
    imagem inline do QR code do ingresso, ou comunicados) usando os mesmos modos
    de conexão SSL/STARTTLS com fallback de `send_email()`. Retorna False se o
    SMTP não estiver configurado."""
    to = (destino or "").strip()
    if not to:
        return False
    if not smtp_configured():
        logger.warning("SMTP não configurado — e-mail não enviado para %s", to)
        return False
    assunto = msg.get("Subject", "") or ""
    return _deliver(msg, to=to, assunto=assunto)


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
