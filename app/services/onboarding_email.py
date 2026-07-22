"""E-mails automáticos do acompanhamento de conta e assinatura."""

from __future__ import annotations

import json
import logging

from app.models import Usuario
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
        return f"{base}/organizador/financeiro/conta-repasse?tracking={esc(tracking_id)}"
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
    link = _conta_repasse_url(tracking_id)
    html = (
        '<div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#18181b">'
        '<h2 style="color:#047857">Conta criada com sucesso</h2>'
        f"<p>Olá, <strong>{esc(usuario.nome or '')}</strong>!</p>"
        "<p>Sua conta de recebimento foi aprovada. Você já pode publicar eventos pagos e receber "
        "repasses automaticamente em cada venda.</p>"
        f'<p><a href="{link}" style="color:#047857">Abrir Financeiro</a></p>'
        '<p style="font-size:11px;color:#a1a1aa">EventosBR — eventosbr.app.br</p>'
        "</div>"
    )
    ok = enqueue_email_simples(destino, "Conta de recebimento aprovada — EventosBR", html)
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
    link = f"{_financeiro_url()}?reenviar=1"
    html = (
        '<div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#18181b">'
        '<h2 style="color:#b91c1c">Não foi possível criar sua conta</h2>'
        f"<p>Olá, <strong>{esc(usuario.nome or '')}</strong>!</p>"
        "<p>A análise da sua conta de recebimento não foi aprovada pelos motivos abaixo:</p>"
        f"{_lista_motivos_html(motivos)}"
        f'<p><a href="{link}" style="color:#047857">Reenviar dados no Financeiro</a></p>'
        '<p style="font-size:11px;color:#a1a1aa">EventosBR — eventosbr.app.br</p>'
        "</div>"
    )
    ok = enqueue_email_simples(destino, "Conta de recebimento não aprovada — EventosBR", html)
    if ok:
        usuario.onboarding_conta_email_event = "REJECTED"
    return ok


def enviar_email_assinatura_contratada(usuario: Usuario) -> bool:
    if (getattr(usuario, "assinatura_tracker_status", None) or "").strip() == "SUBSCRIBED":
        return False
    destino = (usuario.email or "").strip()
    if not destino:
        return False
    link = _financeiro_url()
    html = (
        '<div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#18181b">'
        '<h2 style="color:#047857">Assinatura contratada com sucesso</h2>'
        f"<p>Olá, <strong>{esc(usuario.nome or '')}</strong>!</p>"
        "<p>Bem-vindo ao plano com taxa reduzida por ingresso. A assinatura já está ativa na sua conta.</p>"
        f'<p><a href="{link}" style="color:#047857">Ver Financeiro</a></p>'
        '<p style="font-size:11px;color:#a1a1aa">EventosBR — eventosbr.app.br</p>'
        "</div>"
    )
    ok = enqueue_email_simples(destino, "Bem-vindo à assinatura EventosBR", html)
    if ok:
        usuario.assinatura_tracker_status = "SUBSCRIBED"
    return ok


def enviar_email_assinatura_falhou(usuario: Usuario, *, motivos: list[str]) -> bool:
    destino = (usuario.email or "").strip()
    if not destino:
        return False
    link = _financeiro_url()
    html = (
        '<div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#18181b">'
        '<h2 style="color:#b91c1c">Assinatura não contratada</h2>'
        f"<p>Olá, <strong>{esc(usuario.nome or '')}</strong>!</p>"
        "<p>Não foi possível confirmar o pagamento da sua assinatura pelos motivos abaixo:</p>"
        f"{_lista_motivos_html(motivos)}"
        f'<p><a href="{link}" style="color:#047857">Tentar novamente no Financeiro</a></p>'
        '<p style="font-size:11px;color:#a1a1aa">EventosBR — eventosbr.app.br</p>'
        "</div>"
    )
    ok = enqueue_email_simples(destino, "Assinatura não contratada — EventosBR", html)
    if ok:
        usuario.assinatura_tracker_status = "PAYMENT_FAILED"
        usuario.assinatura_tracker_falha_motivos = json.dumps(motivos, ensure_ascii=False)
    return ok
