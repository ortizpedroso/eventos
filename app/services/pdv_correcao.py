"""Correção de vendas PDV — participante, reassociação de conta e reenvio de ingresso."""

from __future__ import annotations

import logging

from sqlalchemy.orm import Session

from app.models import Evento, Ingresso, Usuario
from app.services.conta_cliente import obter_ou_criar_conta_cliente
from app.services.senha_definir import enviar_email_primeiro_acesso
from app.services.ticket_email import enqueue_ticket_email, send_ticket_email_sync

logger = logging.getLogger(__name__)

_STATUS_EDITABLE = frozenset({"pago", "usado"})


def _normalizar_email(email: str) -> str:
    e = (email or "").strip().lower()
    if not e or "@" not in e or len(e) > 255:
        raise ValueError("Informe um e-mail válido do participante.")
    return e


def _normalizar_nome(nome: str) -> str:
    n = (nome or "").strip()
    if not n:
        raise ValueError("Informe o nome do participante.")
    if len(n) > 200:
        raise ValueError("Nome do participante é longo demais.")
    return n


def _normalizar_telefone(telefone: str | None) -> str | None:
    t = (telefone or "").strip() or None
    if t and len(t) > 20:
        raise ValueError("Telefone inválido.")
    return t


def ingresso_editavel_organizador(
    db: Session,
    *,
    ingresso_id: str,
    evento: Evento,
) -> Ingresso | None:
    ingresso = db.get(Ingresso, ingresso_id)
    if ingresso is None or ingresso.evento_id != evento.id:
        return None
    if (ingresso.status or "").lower() not in _STATUS_EDITABLE:
        raise ValueError("Só ingressos pagos ou já utilizados podem ser corrigidos.")
    return ingresso


def corrigir_participante_ingresso(
    db: Session,
    *,
    ingresso: Ingresso,
    organizador: Usuario,
    participante_nome: str,
    participante_email: str,
    participante_telefone: str | None = None,
) -> Ingresso:
    nome = _normalizar_nome(participante_nome)
    email = _normalizar_email(participante_email)
    telefone = _normalizar_telefone(participante_telefone)

    email_antigo = (ingresso.participante_email or "").strip().lower()
    comprador_antigo_id = ingresso.usuario_id

    if email != email_antigo:
        comprador, conta_nova = obter_ou_criar_conta_cliente(db, email=email, nome=nome)
        ingresso.usuario_id = comprador.id
        if conta_nova:
            enviar_email_primeiro_acesso(db, comprador)

    ingresso.participante_nome = nome
    ingresso.participante_email = email
    ingresso.participante_telefone = telefone

    db.commit()
    db.refresh(ingresso)

    logger.info(
        "PDV correção ingresso %s evento %s por organizador %s: email %s→%s usuario %s→%s",
        ingresso.id,
        ingresso.evento_id,
        organizador.id,
        email_antigo,
        email,
        comprador_antigo_id,
        ingresso.usuario_id,
    )
    return ingresso


def reenviar_email_ingresso(
    db: Session,
    ingresso: Ingresso,
    *,
    organizador: Usuario,
) -> tuple[bool, str]:
    """Tenta envio síncrono; se falha, enfileira retry."""
    if (ingresso.status or "").lower() not in _STATUS_EDITABLE:
        raise ValueError("Só ingressos pagos ou já utilizados podem receber reenvio.")

    destino = (ingresso.participante_email or "").strip()
    if not destino:
        raise ValueError("Ingresso sem e-mail de destino.")

    ok = send_ticket_email_sync(ingresso.id)
    if not ok:
        enqueue_ticket_email(ingresso.id)

    logger.info(
        "PDV reenvio ingresso %s evento %s por organizador %s → %s (sync_ok=%s)",
        ingresso.id,
        ingresso.evento_id,
        organizador.id,
        destino,
        ok,
    )
    return ok, destino
