"""Ações ao confirmar pagamento de um ingresso."""

from __future__ import annotations

import logging

from sqlalchemy.orm import Session

from app.models import Ingresso
from app.services.cupom_desconto import registrar_uso_cupom
from app.services.ticket_email import enqueue_ticket_email

logger = logging.getLogger(__name__)


def marcar_ingresso_pago(db: Session, ingresso: Ingresso) -> bool:
    """Marca como pago (sem commit). Retorna True se o status mudou."""
    if ingresso.status == "pago":
        return False

    if ingresso.status == "cancelado":
        logger.warning(
            "Pagamento confirmado para ingresso já cancelado %s (reserva expirou antes do webhook).",
            ingresso.id,
        )
        return False

    ingresso.status = "pago"
    ingresso.reservado_ate = None
    registrar_uso_cupom(db, getattr(ingresso, "cupom_id", None))
    return True


def notificar_ingresso_pago(ingresso_id: str) -> None:
    """Dispara e-mail do ingresso (após commit)."""
    enqueue_ticket_email(ingresso_id)


def _ingressos_por_ref(db: Session, payment_ref: str) -> list[Ingresso]:
    return (
        db.query(Ingresso)
        .filter(
            (Ingresso.asaas_payment_id == payment_ref)
            | (Ingresso.stripe_payment_intent_id == payment_ref)
        )
        .all()
    )


def marcar_ingressos_pi_pagos(db: Session, payment_ref: str) -> list[str]:
    """Marca todos os ingressos pendentes de um pagamento externo como pagos."""
    alterados: list[str] = []
    for ingresso in _ingressos_por_ref(db, payment_ref):
        if marcar_ingresso_pago(db, ingresso):
            alterados.append(ingresso.id)
    return alterados


def cancelar_ingressos_pi_pendentes(db: Session, payment_ref: str) -> int:
    """Cancela reservas pendentes ligadas ao pagamento externo."""
    n = 0
    for ingresso in _ingressos_por_ref(db, payment_ref):
        if ingresso.status != "pendente":
            continue
        ingresso.status = "cancelado"
        ingresso.reservado_ate = None
        n += 1
    return n


def ingressos_lote_pendente(db: Session, ingresso: Ingresso) -> list[Ingresso]:
    """Ingressos do mesmo lote de compra (mesma reserva / mesmo payment ref)."""
    ref = (ingresso.asaas_payment_id or ingresso.stripe_payment_intent_id or "").strip()
    if ref:
        return _ingressos_por_ref(db, ref)
    q = db.query(Ingresso).filter(
        Ingresso.usuario_id == ingresso.usuario_id,
        Ingresso.evento_id == ingresso.evento_id,
        Ingresso.status == "pendente",
        Ingresso.reservado_ate == ingresso.reservado_ate,
    )
    return q.all()
