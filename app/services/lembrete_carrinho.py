"""Lembrete único de carrinho abandonado (~20 min após iniciar checkout).

Transacional: não exige opt-in de marketing. Envia via fila confiável
(`enqueue_email_simples`). Respeita reserva de 35 min — só envia enquanto
`status=pendente` e `reservado_ate` ainda no futuro.
"""

from __future__ import annotations

import logging
import threading
from datetime import datetime, timedelta, timezone

from sqlalchemy import or_
from sqlalchemy.orm import Session, joinedload

from app.models import Evento, Ingresso, Usuario
from app.services.email_branding import (
    build_email_html,
    format_email_subject,
    get_email_branding,
    link_style,
)
from app.services.notificacao_email import enqueue_email_simples
from app.utils.html_escape import esc
from config.database import SessionLocal
from config.settings import settings

logger = logging.getLogger(__name__)

# Reserva do checkout = 35 min; 20 min deixa ~15 min de folga após o e-mail.
CARRINHO_LEMBRETE_APOS_MINUTOS = 20
_INTERVALO_SEGUNDOS = 60
_stop_event = threading.Event()
_thread: threading.Thread | None = None


def _agora() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _destino_email(ingresso: Ingresso, usuario: Usuario | None) -> str:
    pe = (ingresso.participante_email or "").strip()
    if pe:
        return pe
    if usuario is not None:
        return (usuario.email or "").strip()
    return ""


def _grupo_chave(ingresso: Ingresso) -> str:
    """Dedupe: um e-mail por lote de reserva (qty>1 compartilha payment/reserva)."""
    pay = (ingresso.asaas_payment_id or "").strip()
    if pay:
        return f"pay:{pay}"
    res = ingresso.reservado_ate.isoformat() if ingresso.reservado_ate else ""
    return f"res:{ingresso.evento_id}:{ingresso.usuario_id}:{res}:{ingresso.data_compra}"


def _build_html(ingresso: Ingresso, db: Session) -> str:
    evento = ingresso.evento
    branding = get_email_branding(db)
    base = (settings.FRONTEND_PUBLIC_URL or "http://localhost:3000").rstrip("/")
    link = f"{base}/eventos/{evento.slug}?retomar={ingresso.id}#comprar"
    prefs = f"{base}/conta/perfil"
    nome = esc(ingresso.participante_nome or "olá")
    ev_nome = esc(evento.nome)
    body = (
        f"<p>Olá, <strong>{nome}</strong>!</p>"
        f"<p>Notamos que você começou a comprar ingresso para "
        f"<strong>{ev_nome}</strong>, mas a compra ainda não foi concluída.</p>"
        f"<p>Sua reserva ainda está ativa — você pode continuar de onde parou:</p>"
        f'<p><a href="{link}" style="{link_style(branding)}">Continuar compra</a></p>'
        f'<p style="color:#71717a;font-size:13px;">Se já finalizou ou desistiu, '
        f"pode ignorar este e-mail. "
        f'<a href="{prefs}" style="{link_style(branding)}">Preferências de comunicação</a>.</p>'
    )
    org = getattr(evento, "organizador", None)
    org_name = (org.brand_name or org.nome) if org else None
    return build_email_html(
        title=f"Continue sua compra: {evento.nome}",
        body_html=body,
        branding=branding,
        organizer_name=org_name,
    )


def candidatos_carrinho_abandonado(db: Session, *, agora: datetime | None = None) -> list[Ingresso]:
    """Ingressos elegíveis a um lembrete (ainda sem one-shot marcado)."""
    agora = agora or _agora()
    limite = agora - timedelta(minutes=CARRINHO_LEMBRETE_APOS_MINUTOS)
    return (
        db.query(Ingresso)
        .options(
            joinedload(Ingresso.evento).joinedload(Evento.organizador),
            joinedload(Ingresso.usuario),
        )
        .filter(
            Ingresso.status == "pendente",
            Ingresso.carrinho_lembrete_enviado_em.is_(None),
            Ingresso.data_compra.isnot(None),
            Ingresso.data_compra <= limite,
            Ingresso.reservado_ate.isnot(None),
            Ingresso.reservado_ate > agora,
            or_(
                Ingresso.participante_email.isnot(None),
                Ingresso.usuario_id.isnot(None),
            ),
        )
        .order_by(Ingresso.data_compra.asc())
        .limit(200)
        .all()
    )


def _marcar_grupo_enviado(db: Session, ingresso: Ingresso, quando: datetime) -> None:
    """Marca one-shot no ingresso e nos irmãos do mesmo lote de reserva."""
    pay = (ingresso.asaas_payment_id or "").strip()
    q = db.query(Ingresso).filter(
        Ingresso.evento_id == ingresso.evento_id,
        Ingresso.usuario_id == ingresso.usuario_id,
        Ingresso.status == "pendente",
        Ingresso.carrinho_lembrete_enviado_em.is_(None),
    )
    if pay:
        q = q.filter(Ingresso.asaas_payment_id == pay)
    elif ingresso.reservado_ate is not None:
        q = q.filter(Ingresso.reservado_ate == ingresso.reservado_ate)
    else:
        q = q.filter(Ingresso.id == ingresso.id)
    q.update({"carrinho_lembrete_enviado_em": quando}, synchronize_session=False)


def enviar_lembretes_carrinho() -> int:
    """Enfileira um lembrete por grupo de reserva abandonada. Retorna qtd enfileirada."""
    agora = _agora()
    db: Session = SessionLocal()
    enviados = 0
    vistos: set[str] = set()
    try:
        candidatos = candidatos_carrinho_abandonado(db, agora=agora)
        for ing in candidatos:
            chave = _grupo_chave(ing)
            if chave in vistos:
                continue
            vistos.add(chave)

            if ing.status != "pendente":
                continue
            if not ing.reservado_ate or ing.reservado_ate <= agora:
                continue
            if ing.carrinho_lembrete_enviado_em is not None:
                continue

            destino = _destino_email(ing, getattr(ing, "usuario", None))
            if not destino:
                continue

            branding = get_email_branding(db)
            assunto = format_email_subject(f"Continue sua compra: {ing.evento.nome}", branding)
            html = _build_html(ing, db)
            if not enqueue_email_simples(destino, assunto, html):
                logger.warning("Falha ao enfileirar lembrete carrinho ingresso %s", ing.id)
                continue

            _marcar_grupo_enviado(db, ing, agora)
            enviados += 1

        if enviados:
            db.commit()
        return enviados
    except Exception:
        db.rollback()
        logger.exception("Erro no job de lembrete de carrinho")
        return 0
    finally:
        db.close()


def _worker() -> None:
    logger.info(
        "Worker lembrete carrinho iniciado (após %d min, intervalo %ds)",
        CARRINHO_LEMBRETE_APOS_MINUTOS,
        _INTERVALO_SEGUNDOS,
    )
    while not _stop_event.is_set():
        try:
            n = enviar_lembretes_carrinho()
            if n:
                logger.info("Lembretes de carrinho enfileirados: %d", n)
        except Exception:
            logger.exception("Erro inesperado no worker de lembrete carrinho")
        _stop_event.wait(_INTERVALO_SEGUNDOS)


def start_lembrete_carrinho_worker() -> None:
    global _thread
    if _thread and _thread.is_alive():
        return
    _stop_event.clear()
    _thread = threading.Thread(target=_worker, name="lembrete-carrinho-worker", daemon=True)
    _thread.start()


def stop_lembrete_carrinho_worker() -> None:
    _stop_event.set()
    if _thread:
        _thread.join(timeout=10)
