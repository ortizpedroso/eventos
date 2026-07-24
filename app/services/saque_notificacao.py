"""Notificações (in-app + e-mail) de confirmação/falha de saque via Pix."""

from __future__ import annotations

import logging

from sqlalchemy.orm import Session

from app.models import FinanceiroSaque, Usuario, UsuarioNotificacao
from app.services.email_branding import build_email_html, format_email_subject, get_email_branding, link_style
from app.services.notificacao_email import enqueue_email_simples
from app.utils.html_escape import assunto_email_seguro, esc
from app.utils.privacy import mask_pix_chave
from config.settings import settings

logger = logging.getLogger(__name__)


def _financeiro_url() -> str:
    base = (settings.FRONTEND_PUBLIC_URL or "http://localhost:3000").rstrip("/")
    return f"{base}/organizador/financeiro"


def _fmt_data_hora(dt) -> str:
    if not dt:
        return "—"
    return dt.strftime("%d/%m/%Y às %H:%M")


def _resolver_usuario(db: Session, saque: FinanceiroSaque, usuario: Usuario | None) -> Usuario | None:
    if usuario:
        return usuario
    if saque.organizador:
        return saque.organizador
    return db.get(Usuario, saque.organizador_id)


def notificar_saque_pago(db: Session, saque: FinanceiroSaque, *, usuario: Usuario | None = None) -> None:
    org = _resolver_usuario(db, saque, usuario)
    if not org:
        return

    branding = get_email_branding(db)
    valor_fmt = f"R$ {float(saque.valor):.2f}".replace(".", ",")
    data_fmt = _fmt_data_hora(saque.processado_em)
    chave_mascarada = mask_pix_chave(saque.pix_chave, saque.pix_tipo)
    link = _financeiro_url()

    db.add(
        UsuarioNotificacao(
            usuario_id=org.id,
            tipo="saque",
            titulo="Saque confirmado",
            mensagem=f"Seu saque de {valor_fmt} foi transferido em {data_fmt}.",
            link=link,
        )
    )

    destino = (org.email or "").strip()
    if destino:
        body = (
            f"<p>Olá, <strong>{esc(org.nome or '')}</strong>!</p>"
            f"<p>Sua transferência via Pix foi concluída com sucesso.</p>"
            '<table style="width:100%;border-collapse:collapse;margin:16px 0">'
            f'<tr><td style="padding:4px 0;color:#71717a">Valor</td><td style="padding:4px 0;text-align:right"><strong>{esc(valor_fmt)}</strong></td></tr>'
            f'<tr><td style="padding:4px 0;color:#71717a">Data e horário</td><td style="padding:4px 0;text-align:right">{esc(data_fmt)}</td></tr>'
            f'<tr><td style="padding:4px 0;color:#71717a">Chave Pix</td><td style="padding:4px 0;text-align:right">{esc(chave_mascarada)}</td></tr>'
            f'<tr><td style="padding:4px 0;color:#71717a">ID do saque</td><td style="padding:4px 0;text-align:right">{esc(saque.id)}</td></tr>'
            f'<tr><td style="padding:4px 0;color:#71717a">ID da transferência (Asaas)</td><td style="padding:4px 0;text-align:right">{esc(saque.asaas_transfer_id or "—")}</td></tr>'
            "</table>"
            f'<p><a href="{link}" style="{link_style(branding)}">Ver extrato no Financeiro</a></p>'
        )
        html = build_email_html(title="Saque confirmado", body_html=body, branding=branding)
        assunto = format_email_subject(f"Saque de {assunto_email_seguro(valor_fmt)} confirmado", branding)
        enqueue_email_simples(destino, assunto, html)

    logger.info("Notificação de saque pago enviada: saque=%s organizador=%s", saque.id, org.id)


def notificar_saque_falhou(db: Session, saque: FinanceiroSaque, *, usuario: Usuario | None = None) -> None:
    org = _resolver_usuario(db, saque, usuario)
    if not org:
        return

    branding = get_email_branding(db)
    valor_fmt = f"R$ {float(saque.valor):.2f}".replace(".", ",")
    data_fmt = _fmt_data_hora(saque.atualizado_em)
    motivo = (saque.observacao or "Motivo não informado pelo banco.").strip()
    link = _financeiro_url()

    db.add(
        UsuarioNotificacao(
            usuario_id=org.id,
            tipo="saque_falha",
            titulo="Saque não foi concluído",
            mensagem=f"Seu saque de {valor_fmt} não pôde ser transferido. O valor voltou ao seu saldo disponível.",
            link=link,
        )
    )

    destino = (org.email or "").strip()
    if destino:
        body = (
            f"<p>Olá, <strong>{esc(org.nome or '')}</strong>!</p>"
            f"<p>Sua transferência via Pix não pôde ser realizada. O valor já retornou ao seu saldo disponível para saque.</p>"
            '<table style="width:100%;border-collapse:collapse;margin:16px 0">'
            f'<tr><td style="padding:4px 0;color:#71717a">Valor</td><td style="padding:4px 0;text-align:right"><strong>{esc(valor_fmt)}</strong></td></tr>'
            f'<tr><td style="padding:4px 0;color:#71717a">Data e horário</td><td style="padding:4px 0;text-align:right">{esc(data_fmt)}</td></tr>'
            f'<tr><td style="padding:4px 0;color:#71717a">Motivo</td><td style="padding:4px 0;text-align:right">{esc(motivo)}</td></tr>'
            f'<tr><td style="padding:4px 0;color:#71717a">ID do saque</td><td style="padding:4px 0;text-align:right">{esc(saque.id)}</td></tr>'
            "</table>"
            f'<p><a href="{link}" style="{link_style(branding)}">Solicitar novo saque no Financeiro</a></p>'
        )
        html = build_email_html(title="Saque não concluído", body_html=body, branding=branding, error=True)
        assunto = format_email_subject(f"Saque de {assunto_email_seguro(valor_fmt)} não concluído", branding)
        enqueue_email_simples(destino, assunto, html)

    logger.info("Notificação de saque falhou enviada: saque=%s organizador=%s", saque.id, org.id)
