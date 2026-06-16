"""Ações ao confirmar pagamento de um ingresso."""

from __future__ import annotations

import logging

from sqlalchemy.orm import Session

from app.models import Ingresso
from app.services.cupom_desconto import registrar_uso_cupom
from app.services.ticket_email import enqueue_ticket_email

logger = logging.getLogger(__name__)


def marcar_ingresso_pago(db: Session, ingresso: Ingresso) -> bool:
    """Marca como pago (sem commit). Retorna True se o status mudou.

    Casos tratados:
    - já pago → idempotente, retorna False
    - cancelado → o ingresso expirou antes do webhook chegar; não reativa
      (o Stripe PI deveria ter sido cancelado pelo cleanup, mas em caso de
      atraso de rede o webhook pode chegar depois — logamos e ignoramos)
    - pendente → transição normal, limpa reservado_ate
    """
    if ingresso.status == "pago":
        return False

    if ingresso.status == "cancelado":
        logger.warning(
            "PI confirmado para ingresso já cancelado %s (reserva expirou antes do webhook). "
            "Verifique se o reembolso foi processado pelo Stripe.",
            ingresso.id,
        )
        return False

    ingresso.status = "pago"
    ingresso.reservado_ate = None  # limpa o prazo de reserva
    registrar_uso_cupom(db, getattr(ingresso, "cupom_id", None))
    return True


def notificar_ingresso_pago(ingresso_id: str) -> None:
    """Dispara e-mail do ingresso (após commit)."""
    enqueue_ticket_email(ingresso_id)


def marcar_ingressos_pi_pagos(db: Session, payment_intent_id: str) -> list[str]:
    """Marca todos os ingressos pendentes de um PaymentIntent como pagos."""
    alterados: list[str] = []
    ingressos = (
        db.query(Ingresso)
        .filter(Ingresso.stripe_payment_intent_id == payment_intent_id)
        .all()
    )
    for ingresso in ingressos:
        if marcar_ingresso_pago(db, ingresso):
            alterados.append(ingresso.id)
    return alterados


def cancelar_ingressos_pi_pendentes(db: Session, payment_intent_id: str) -> int:
    """Cancela reservas pendentes ligadas ao PaymentIntent."""
    n = 0
    ingressos = (
        db.query(Ingresso)
        .filter(
            Ingresso.stripe_payment_intent_id == payment_intent_id,
            Ingresso.status == "pendente",
        )
        .all()
    )
    for ingresso in ingressos:
        ingresso.status = "cancelado"
        ingresso.reservado_ate = None
        n += 1
    return n
