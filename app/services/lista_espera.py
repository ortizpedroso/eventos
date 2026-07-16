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
from app.utils.html_escape import assunto_email_seguro, esc
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


def expirar_janelas_espera_ativas(db: Session, evento_id: str) -> int:
    """Expira notificações ativas (ex.: organizador desabilitou a lista de espera)."""
    agora = _agora()
    ativos = (
        db.query(EventoListaEspera)
        .filter(
            EventoListaEspera.evento_id == evento_id,
            EventoListaEspera.status == "notificado",
            EventoListaEspera.token_expira_em.isnot(None),
            EventoListaEspera.token_expira_em > agora,
        )
        .all()
    )
    for ent in ativos:
        ent.status = "expirado"
        ent.token_compra = None
        ent.token_expira_em = None
    if ativos:
        db.commit()
    return len(ativos)


def inscrever_espera(
    db: Session,
    evento: Evento,
    *,
    email: str,
    nome: str | None = None,
    usuario: Usuario | None = None,
) -> EventoListaEspera:
    from app.services.ingresso_lotes import ingressos_esgotados_sem_vaga

    if not evento.lista_espera_habilitada:
        raise HTTPException(status_code=400, detail="Lista de espera não está habilitada para este evento.")
    if not ingressos_esgotados_sem_vaga(db, evento):
        raise HTTPException(
            status_code=400,
            detail="Lista de espera só está disponível quando os ingressos estão esgotados.",
        )

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
    nome = esc(evento.nome)
    assunto = f"Vaga disponível: {assunto_email_seguro(evento.nome)}"
    corpo = (
        f"<p>Uma vaga foi liberada para <strong>{nome}</strong>.</p>"
        f"<p>Você tem <strong>{prazo} horas</strong> para concluir a compra.</p>"
        f'<p><a href="{link}">Comprar agora</a></p>'
    )
    enqueue_email_simples(entrada.email, assunto, corpo)
    _criar_notificacao_in_app(
        db,
        entrada.usuario_id,
        titulo="Vaga na lista de espera",
        mensagem=f"Compre seu ingresso para {assunto_email_seguro(evento.nome)} em até {prazo}h.",
        link=link,
    )
    db.commit()
    logger.info("Lista espera: notificado %s evento %s", entrada.email, evento.id)


def expirar_espera_reserva_nao_concluida(db: Session, ingresso: Ingresso) -> bool:
    """Expira entrada notificada do mesmo e-mail quando a reserva pendente é cancelada."""
    evento = db.get(Evento, ingresso.evento_id)
    if not evento or not evento.lista_espera_habilitada:
        return False
    email = (ingresso.participante_email or "").strip().lower()
    if not email:
        return False
    entrada = (
        db.query(EventoListaEspera)
        .filter(
            EventoListaEspera.evento_id == evento.id,
            EventoListaEspera.email == email,
            EventoListaEspera.status == "notificado",
        )
        .first()
    )
    if not entrada:
        return False
    entrada.status = "expirado"
    entrada.token_compra = None
    entrada.token_expira_em = None
    db.flush()
    return True


def liberar_vagas_apos_cancelamento(db: Session, evento_id: str, quantidade: int = 1) -> int:
    """Chamar após cancelamento/liberação de vaga(s)."""
    evento = db.get(Evento, evento_id)
    if not evento or not evento.lista_espera_habilitada:
        return 0

    if janela_exclusiva_espera_ativa(db, evento_id):
        return 0

    notificados = 0
    for _ in range(max(1, quantidade)):
        if janela_exclusiva_espera_ativa(db, evento_id):
            break
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


def janela_exclusiva_espera_ativa(db: Session, evento_id: str) -> bool:
    """Há comprador notificado com janela exclusiva ainda válida."""
    agora = _agora()
    return (
        db.query(EventoListaEspera)
        .filter(
            EventoListaEspera.evento_id == evento_id,
            EventoListaEspera.status == "notificado",
            EventoListaEspera.token_expira_em.isnot(None),
            EventoListaEspera.token_expira_em > agora,
        )
        .first()
        is not None
    )


def validar_espera_para_ingresso_pendente(
    db: Session,
    ingresso: Ingresso,
    token: str | None = None,
) -> None:
    """Revalida janela exclusiva ao retomar, cobrar ou concluir pagamento pendente."""
    evento = db.get(Evento, ingresso.evento_id)
    if not evento:
        return
    if not janela_exclusiva_espera_ativa(db, evento.id):
        return

    email = (ingresso.participante_email or "").strip()
    if not email:
        raise HTTPException(
            status_code=403,
            detail="Participante sem e-mail: não é possível validar a lista de espera.",
        )

    if token and token.strip():
        validar_compra_com_token_espera(db, evento, token, email)
        return

    # Sem token na requisição: permite quem já está notificado com o mesmo e-mail
    # (ex.: retomar compra iniciada pelo link da fila).
    email_l = email.lower()
    agora = _agora()
    entrada = (
        db.query(EventoListaEspera)
        .filter(
            EventoListaEspera.evento_id == evento.id,
            EventoListaEspera.email == email_l,
            EventoListaEspera.status == "notificado",
            EventoListaEspera.token_expira_em.isnot(None),
            EventoListaEspera.token_expira_em > agora,
        )
        .first()
    )
    if entrada:
        return

    raise HTTPException(
        status_code=403,
        detail=(
            "Esta vaga está reservada para quem recebeu o link da lista de espera. "
            "Use o e-mail enviado pela plataforma."
        ),
    )


def validar_compra_com_token_espera(
    db: Session,
    evento: Evento,
    token: str | None,
    email_participante: str,
) -> None:
    """Exige token válido enquanto houver janela exclusiva da lista de espera."""
    if not janela_exclusiva_espera_ativa(db, evento.id):
        return
    if not token or not token.strip():
        raise HTTPException(
            status_code=403,
            detail=(
                "Esta vaga está reservada para quem recebeu o link da lista de espera. "
                "Use o e-mail enviado pela plataforma."
            ),
        )
    entrada = validar_token_espera(db, evento, token)
    if not entrada:
        raise HTTPException(status_code=400, detail="Link da lista de espera inválido ou expirado.")
    if email_participante.strip().lower() != entrada.email:
        raise HTTPException(
            status_code=403,
            detail="O e-mail do participante deve ser o da lista de espera.",
        )


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
        .with_for_update()
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
        entrada.token_expira_em = None
        db.flush()


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
