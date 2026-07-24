"""E-mails automáticos do acompanhamento de conta e assinatura."""

from __future__ import annotations

import json
import logging
from urllib.parse import quote

from app.models import Usuario
from app.services.email_branding import build_email_html, format_email_subject, get_email_branding, link_style
from app.services.notificacao_email import enqueue_email_simples
from app.utils.html_escape import esc
from config.settings import settings

logger = logging.getLogger(__name__)


def _financeiro_url() -> str:
    base = (settings.FRONTEND_PUBLIC_URL or "http://localhost:3000").rstrip("/")
    return f"{base}/organizador/financeiro"


def _conta_repasse_url(tracking_id: str | None = None) -> str:
    base = (settings.FRONTEND_PUBLIC_URL or "http://localhost:3000").rstrip("/")
    if tracking_id:
        return f"{base}/organizador/financeiro/conta-repasse?tracking={quote(tracking_id, safe='')}"
    return f"{base}/organizador/financeiro/conta-repasse"


def _lista_motivos_html(motivos: list[str]) -> str:
    if not motivos:
        return "<p>Revise os dados enviados e tente novamente.</p>"
    itens = "".join(f"<li>{esc(m)}</li>" for m in motivos if str(m).strip())
    return f"<ul>{itens}</ul>"


def enviar_email_conta_aprovada(usuario: Usuario, *, tracking_id: str | None = None) -> bool:
    if (getattr(usuario, "onboarding_conta_email_event", None) or "").strip() == "APPROVED":
        return False
    destino = (usuario.email or "").strip()
    if not destino:
        return False
    branding = get_email_branding()
    link = _conta_repasse_url(tracking_id)
    body = (
        f"<p>Olá, <strong>{esc(usuario.nome or '')}</strong>!</p>"
        "<p>Sua conta de recebimento foi aprovada. Você já pode publicar eventos pagos e receber "
        "repasses automaticamente em cada venda.</p>"
        f'<p><a href="{link}" style="{link_style(branding)}">Abrir Financeiro</a></p>'
    )
    html = build_email_html(title="Conta criada com sucesso", body_html=body, branding=branding)
    ok = enqueue_email_simples(
        destino,
        format_email_subject("Conta de recebimento aprovada", branding),
        html,
    )
    if ok:
        usuario.onboarding_conta_email_event = "APPROVED"
    return ok


def enviar_email_conta_reprovada(
    usuario: Usuario,
    *,
    motivos: list[str],
    tracking_id: str | None = None,
) -> bool:
    if (getattr(usuario, "onboarding_conta_email_event", None) or "").strip() == "REJECTED":
        return False
    destino = (usuario.email or "").strip()
    if not destino:
        return False
    branding = get_email_branding()
    link = f"{_financeiro_url()}?reenviar=1"
    body = (
        f"<p>Olá, <strong>{esc(usuario.nome or '')}</strong>!</p>"
        "<p>A análise da sua conta de recebimento não foi aprovada pelos motivos abaixo:</p>"
        f"{_lista_motivos_html(motivos)}"
        f'<p><a href="{link}" style="{link_style(branding)}">Reenviar dados no Financeiro</a></p>'
    )
    html = build_email_html(title="Não foi possível criar sua conta", body_html=body, branding=branding, error=True)
    ok = enqueue_email_simples(
        destino,
        format_email_subject("Conta de recebimento não aprovada", branding),
        html,
    )
    if ok:
        usuario.onboarding_conta_email_event = "REJECTED"
    return ok


def enviar_email_assinatura_contratada(usuario: Usuario) -> bool:
    if (getattr(usuario, "assinatura_tracker_status", None) or "").strip() == "SUBSCRIBED":
        return False
    destino = (usuario.email or "").strip()
    if not destino:
        return False
    branding = get_email_branding()
    link = _financeiro_url()
    body = (
        f"<p>Olá, <strong>{esc(usuario.nome or '')}</strong>!</p>"
        "<p>Bem-vindo ao plano com taxa reduzida por ingresso. A assinatura já está ativa na sua conta.</p>"
        f'<p><a href="{link}" style="{link_style(branding)}">Ver Financeiro</a></p>'
    )
    html = build_email_html(title="Assinatura contratada com sucesso", body_html=body, branding=branding)
    ok = enqueue_email_simples(
        destino,
        format_email_subject("Bem-vindo à assinatura", branding),
        html,
    )
    if ok:
        usuario.assinatura_tracker_status = "SUBSCRIBED"
    return ok


def enviar_email_assinatura_falhou(usuario: Usuario, *, motivos: list[str]) -> bool:
    if (getattr(usuario, "assinatura_tracker_status", None) or "").strip() == "PAYMENT_FAILED":
        return False
    destino = (usuario.email or "").strip()
    if not destino:
        return False
    branding = get_email_branding()
    link = _financeiro_url()
    body = (
        f"<p>Olá, <strong>{esc(usuario.nome or '')}</strong>!</p>"
        "<p>Não foi possível confirmar o pagamento da sua assinatura pelos motivos abaixo:</p>"
        f"{_lista_motivos_html(motivos)}"
        f'<p><a href="{link}" style="{link_style(branding)}">Tentar novamente no Financeiro</a></p>'
    )
    html = build_email_html(title="Assinatura não contratada", body_html=body, branding=branding, error=True)
    ok = enqueue_email_simples(
        destino,
        format_email_subject("Assinatura não contratada", branding),
        html,
    )
    if ok:
        usuario.assinatura_tracker_status = "PAYMENT_FAILED"
        usuario.assinatura_tracker_falha_motivos = json.dumps(motivos, ensure_ascii=False)
    return ok
