"""Suspensão de eventos pela plataforma: tira da vitrine, trava a republicação e avisa o organizador."""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Literal

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models import Evento
from app.services.email_branding import build_email_html, format_email_subject, get_email_branding, link_style
from app.services.notificacao_email import enqueue_email_simples
from app.utils.html_escape import esc
from config.settings import settings

logger = logging.getLogger(__name__)

MotivoSuspensao = Literal["ofensivo", "ilegal", "falso", "incompleto", "outro"]

MOTIVOS_SUSPENSAO: dict[str, str] = {
    "ofensivo": "Conteúdo ofensivo ou discriminatório",
    "ilegal": "Conteúdo ou atividade em desacordo com a lei",
    "falso": "Evento falso ou informações enganosas",
    "incompleto": "Informações essenciais incompletas",
    "outro": "Violação dos Termos de Uso",
}


def rotulo_motivo(motivo: str | None) -> str | None:
    return MOTIVOS_SUSPENSAO.get(motivo or "") if motivo else None


def exigir_evento_nao_suspenso(evento: Evento) -> None:
    """Organizador não publica nem duplica evento suspenso; só a plataforma libera."""
    if evento.suspenso_em is None:
        return
    raise HTTPException(
        status_code=403,
        detail=(
            f"Este evento foi suspenso pela EventosBR ({rotulo_motivo(evento.suspenso_motivo)}). "
            "Para contestar, responda ao e-mail que enviamos ou fale com a gente em Contato."
        ),
    )


def _agora() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _contato_url() -> str:
    return f"{(settings.FRONTEND_PUBLIC_URL or 'http://localhost:3000').rstrip('/')}/contato"


def _enviar_email(evento: Evento, *, titulo: str, assunto: str, corpo: str, erro: bool) -> bool:
    organizador = evento.organizador
    destino = (getattr(organizador, "email", None) or "").strip()
    if not destino:
        return False
    branding = get_email_branding()
    body = (
        f"<p>Olá, <strong>{esc(getattr(organizador, 'nome', '') or '')}</strong>!</p>"
        f"{corpo}"
        f'<p><a href="{_contato_url()}" style="{link_style(branding)}">Falar com a EventosBR</a></p>'
    )
    html = build_email_html(title=titulo, body_html=body, branding=branding, error=erro)
    try:
        return enqueue_email_simples(destino, format_email_subject(assunto, branding), html)
    except Exception:
        logger.exception("Falha ao enfileirar e-mail de moderação do evento %s", evento.id)
        return False


def suspender_evento(
    db: Session, evento: Evento, *, motivo: MotivoSuspensao, detalhe: str, por: str
) -> bool:
    """Suspende e avisa o organizador. Retorna se o e-mail foi enfileirado."""
    evento.publicado = False
    evento.suspenso_em = _agora()
    evento.suspenso_motivo = motivo
    evento.suspenso_detalhe = detalhe.strip()
    evento.suspenso_por = por
    db.commit()
    db.refresh(evento)
    logger.info("moderacao=suspenso evento_id=%s motivo=%s por=%s", evento.id, motivo, por)
    corpo = (
        f"<p>O evento <strong>{esc(evento.nome or '')}</strong> foi suspenso e saiu do ar na EventosBR.</p>"
        f"<p><strong>Motivo:</strong> {esc(MOTIVOS_SUSPENSAO[motivo])}</p>"
        f"<p>{esc(evento.suspenso_detalhe or '')}</p>"
        "<p>Enquanto estiver suspenso, o evento não pode ser republicado nem vendido. "
        "Ingressos já emitidos continuam válidos.</p>"
        "<p>Se você acredita que houve um engano, responda a este e-mail ou fale com a gente "
        "explicando o que deve ser revisto.</p>"
    )
    return _enviar_email(evento, titulo="Evento suspenso", assunto=f"Evento suspenso: {evento.nome}", corpo=corpo, erro=True)


def reativar_evento(db: Session, evento: Evento, *, por: str) -> bool:
    """Retira a suspensão. O evento continua pausado até o organizador publicar de novo."""
    evento.suspenso_em = None
    evento.suspenso_motivo = None
    evento.suspenso_detalhe = None
    evento.suspenso_por = None
    db.commit()
    db.refresh(evento)
    logger.info("moderacao=reativado evento_id=%s por=%s", evento.id, por)
    corpo = (
        f"<p>A suspensão do evento <strong>{esc(evento.nome or '')}</strong> foi retirada.</p>"
        "<p>Ele está pausado: publique de novo no seu painel, em Meus eventos, quando quiser voltar a vender.</p>"
    )
    return _enviar_email(evento, titulo="Suspensão retirada", assunto=f"Evento liberado: {evento.nome}", corpo=corpo, erro=False)
