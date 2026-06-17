"""Lista de espera FIFO com link exclusivo de compra."""

from __future__ import annotations

import logging
import secrets
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models import Evento, EventoListaEspera, Ingresso, Usuario, UsuarioNotificacao
from app.services.notificacao_email import enqueue_email_simples
from config.settings import settings

logger = logging.getLogger(__name__)

PRAZOS_VALIDOS = frozenset({12, 24, 48})


def _agora() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _proxima_posicao(db: Session, evento_id: str) -> int:
    max_pos = (
        db.query(func.max(EventoListaEspera.posicao))
        .filter(EventoListaEspera.evento_id == evento_id)
        .scalar()
    )
    return int(max_pos or 0) + 1


def usuario_tem_ingresso_pago(db: Session, evento_id: str, email: str, usuario_id: str | None) -> bool:
    q = db.query(Ingresso).filter(
        Ingresso.evento_id == evento_id,
        Ingresso.status.in_(("pago", "usado", "pendente")),
    )
    email_l = email.strip().lower()
    if usuario_id:
        q = q.filter(
            (Ingresso.usuario_id == usuario_id) | (Ingresso.participante_email.ilike(email_l)),
        )
    else:
        q = q.filter(Ingresso.participante_email.ilike(email_l))
    return q.first() is not None


def inscrever_espera(
    db: Session,
    evento: Evento,
    *,
    email: str,
    nome: str | None = None,
    usuario: Usuario | None = None,
) -> EventoListaEspera:
    if not evento.lista_espera_habilitada:
        raise HTTPException(status_code=400, detail="Lista de espera não está habilitada para este evento.")

    email_norm = email.strip().lower()
    if not email_norm or "@" not in email_norm:
        raise HTTPException(status_code=400, detail="E-mail inválido.")

    uid = usuario.id if usuario else None
    if usuario_tem_ingresso_pago(db, evento.id, email_norm, uid):
        raise HTTPException(status_code=400, detail="Você já possui ingresso neste evento.")

    existente = (
        db.query(EventoListaEspera)
        .filter(EventoListaEspera.evento_id == evento.id, EventoListaEspera.email == email_norm)
        .first()
    )
    if existente:
        if existente.status in ("aguardando", "notificado"):
            return existente
        if existente.status in ("expirado", "cancelado", "comprado"):
            existente.status = "aguardando"
            existente.posicao = _proxima_posicao(db, evento.id)
            existente.token_compra = None
            existente.token_expira_em = None
            existente.notificado_em = None
            db.commit()
            db.refresh(existente)
            return existente

    row = EventoListaEspera(
        evento_id=evento.id,
        usuario_id=uid,
        email=email_norm,
        nome=(nome or (usuario.nome if usuario else None) or "").strip()[:120] or None,
        posicao=_proxima_posicao(db, evento.id),
        status="aguardando",
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def _criar_notificacao_in_app(
    db: Session,
    usuario_id: str | None,
    *,
    titulo: str,
    mensagem: str,
    link: str,
) -> None:
    if not usuario_id:
        return
    db.add(
        UsuarioNotificacao(
            usuario_id=usuario_id,
            tipo="lista_espera",
            titulo=titulo,
            mensagem=mensagem,
            link=link,
        )
    )


def _notificar_proximo(db: Session, evento: Evento, entrada: EventoListaEspera) -> None:
    prazo = evento.lista_espera_prazo_horas or 24
    if prazo not in PRAZOS_VALIDOS:
        prazo = 24

    token = secrets.token_urlsafe(32)
    expira = _agora() + timedelta(hours=prazo)
    entrada.token_compra = token
    entrada.token_expira_em = expira
    entrada.status = "notificado"
    entrada.notificado_em = _agora()

    base = (settings.FRONTEND_PUBLIC_URL or "http://localhost:3000").rstrip("/")
    link = f"{base}/eventos/{evento.slug}?espera={token}"
    assunto = f"Vaga disponível: {evento.nome}"
    corpo = (
        f"<p>Uma vaga foi liberada para <strong>{evento.nome}</strong>.</p>"
        f"<p>Você tem <strong>{prazo} horas</strong> para concluir a compra.</p>"
        f'<p><a href="{link}">Comprar agora</a></p>'
    )
    enqueue_email_simples(entrada.email, assunto, corpo)
    _criar_notificacao_in_app(
        db,
        entrada.usuario_id,
        titulo="Vaga na lista de espera",
        mensagem=f"Compre seu ingresso para {evento.nome} em até {prazo}h.",
        link=link,
    )
    db.commit()
    logger.info("Lista espera: notificado %s evento %s", entrada.email, evento.id)


def liberar_vagas_apos_cancelamento(db: Session, evento_id: str, quantidade: int = 1) -> int:
    """Chamar após cancelamento/liberação de vaga(s)."""
    evento = db.get(Evento, evento_id)
    if not evento or not evento.lista_espera_habilitada:
        return 0

    notificados = 0
    for _ in range(max(1, quantidade)):
        prox = (
            db.query(EventoListaEspera)
            .filter(
                EventoListaEspera.evento_id == evento_id,
                EventoListaEspera.status == "aguardando",
            )
            .order_by(EventoListaEspera.posicao.asc())
            .first()
        )
        if not prox:
            break
        _notificar_proximo(db, evento, prox)
        notificados += 1
    return notificados


def validar_token_espera(db: Session, evento: Evento, token: str | None) -> EventoListaEspera | None:
    if not token:
        return None
    entrada = (
        db.query(EventoListaEspera)
        .filter(
            EventoListaEspera.evento_id == evento.id,
            EventoListaEspera.token_compra == token.strip(),
            EventoListaEspera.status == "notificado",
        )
        .first()
    )
    if not entrada:
        return None
    if entrada.token_expira_em and entrada.token_expira_em < _agora():
        entrada.status = "expirado"
        entrada.token_compra = None
        db.commit()
        liberar_vagas_apos_cancelamento(db, evento.id, 1)
        return None
    return entrada


def marcar_espera_comprada(db: Session, evento_id: str, email: str) -> None:
    email_norm = email.strip().lower()
    entrada = (
        db.query(EventoListaEspera)
        .filter(
            EventoListaEspera.evento_id == evento_id,
            EventoListaEspera.email == email_norm,
            EventoListaEspera.status.in_(("notificado", "aguardando")),
        )
        .first()
    )
    if entrada:
        entrada.status = "comprado"
        entrada.token_compra = None
        db.commit()


def expirar_tokens_vencidos(db: Session) -> int:
    """Worker/cron: expira links e passa para o próximo da fila."""
    agora = _agora()
    vencidos = (
        db.query(EventoListaEspera)
        .filter(
            EventoListaEspera.status == "notificado",
            EventoListaEspera.token_expira_em.isnot(None),
            EventoListaEspera.token_expira_em < agora,
        )
        .all()
    )
    total = 0
    for ent in vencidos:
        evento_id = ent.evento_id
        ent.status = "expirado"
        ent.token_compra = None
        db.commit()
        total += liberar_vagas_apos_cancelamento(db, evento_id, 1)
    return total
