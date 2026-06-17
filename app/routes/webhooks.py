import json
import logging
import secrets
import stripe
from fastapi import APIRouter, Request, HTTPException, Depends
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models import Ingresso, StripeEvent, get_db
from app.services.ingresso_pago import (
    cancelar_ingressos_pi_pendentes,
    marcar_ingresso_pago,
    marcar_ingressos_pi_pagos,
    notificar_ingresso_pago,
)
from config.settings import settings

logger = logging.getLogger(__name__)
router = APIRouter()

_WEBHOOK_PLACEHOLDER = "whsec_seu_webhook_secret_aqui"


def _parse_stripe_webhook_event(payload: bytes, sig_header: str | None) -> dict:
    """Valida assinatura em produção; em dev permite JSON sem whsec configurado."""
    whsec = (settings.STRIPE_WEBHOOK_SECRET or "").strip()
    dev_sem_secret = (
        settings.ENVIRONMENT != "production"
        and settings.DEBUG
        and settings.ENVIRONMENT == "development"
        and (not whsec or whsec == _WEBHOOK_PLACEHOLDER)
    )
    if dev_sem_secret:
        logger.warning(
            "Webhook Stripe: assinatura NÃO verificada (DEBUG+development e sem whsec real). "
            "Configure STRIPE_WEBHOOK_SECRET para produção."
        )
        try:
            return json.loads(payload.decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError) as e:
            logger.error("Payload JSON inválido no Webhook: %s", e)
            raise HTTPException(status_code=400, detail="Invalid payload") from e

    try:
        return stripe.Webhook.construct_event(payload, sig_header, whsec)
    except ValueError:
        logger.error("Payload inválido recebido no Webhook")
        raise HTTPException(status_code=400, detail="Invalid payload")
    except stripe.error.SignatureVerificationError:
        logger.error("Assinatura inválida recebida no Webhook")
        raise HTTPException(status_code=400, detail="Invalid signature")


def _validar_token_webhook_asaas(token_header: str) -> None:
    """Fail-closed: exige token configurado fora de dev/test com mock explícito."""
    expected = (settings.ASAAS_WEBHOOK_TOKEN or "").strip()
    if settings.ENVIRONMENT == "production":
        if not expected:
            logger.error("Webhook Asaas: ASAAS_WEBHOOK_TOKEN ausente em produção")
            raise HTTPException(status_code=503, detail="Webhook not configured")
        if not secrets.compare_digest(token_header, expected):
            logger.error("Webhook Asaas: token inválido")
            raise HTTPException(status_code=401, detail="Invalid token")
        return
    if not expected:
        if settings.ASAAS_E2E_MOCK and settings.ENVIRONMENT in ("development", "test"):
            logger.warning("Webhook Asaas sem token (ASAAS_E2E_MOCK)")
            return
        logger.error("Webhook Asaas: ASAAS_WEBHOOK_TOKEN ausente")
        raise HTTPException(status_code=503, detail="Webhook not configured")
    if not secrets.compare_digest(token_header, expected):
        logger.error("Webhook Asaas: token inválido")
        raise HTTPException(status_code=401, detail="Invalid token")


@router.post("/asaas")
async def asaas_webhook(request: Request, db: Session = Depends(get_db)):
    """Recebe eventos do Asaas (PAYMENT_RECEIVED, PAYMENT_CONFIRMED, etc.)."""
    payload = await request.body()
    token_header = request.headers.get("asaas-access-token", "")
    _validar_token_webhook_asaas(token_header)

    try:
        event = json.loads(payload.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as e:
        raise HTTPException(status_code=400, detail="Invalid payload") from e

    event_id = str(event.get("id") or "")
    event_type = event.get("event", "unknown")
    payment = event.get("payment") or {}
    pay_id = payment.get("id") or ""

    logger.info("Webhook Asaas: %s (%s)", event_type, event_id or pay_id)

    if event_id:
        existente = db.get(StripeEvent, event_id)
        if existente:
            return {"status": "success", "idempotent": True}

    ingressos_recém_pagos: list[str] = []
    try:
        if event_type in ("PAYMENT_RECEIVED", "PAYMENT_CONFIRMED") and pay_id:
            ingressos_recém_pagos = marcar_ingressos_pi_pagos(db, pay_id)
        elif event_type in ("PAYMENT_DELETED", "PAYMENT_REFUNDED", "PAYMENT_OVERDUE") and pay_id:
            cancelar_ingressos_pi_pendentes(db, pay_id)

        if event_id:
            db.add(StripeEvent(id=event_id, tipo=event_type))
        db.commit()
        for iid in ingressos_recém_pagos:
            notificar_ingresso_pago(iid)
    except IntegrityError:
        db.rollback()
        return {"status": "success", "idempotent": True}

    return {"status": "success"}


@router.post("/stripe")
async def stripe_webhook(request: Request, db: Session = Depends(get_db)):
    """Recebe eventos do Stripe via Webhook"""
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature")

    event = _parse_stripe_webhook_event(payload, sig_header)

    event_id = event.get("id")
    event_type = event.get("type", "unknown")
    logger.info("Webhook Stripe recebido: %s (%s)", event_type, event_id or "sem-id")

    if event_id:
        existente = db.get(StripeEvent, event_id)
        if existente:
            return {"status": "success", "idempotent": True}

    ingressos_recém_pagos: list[str] = []
    try:
        if event_type == "payment_intent.succeeded":
            payment_intent = event["data"]["object"]
            pi_id = payment_intent["id"]
            ingressos_recém_pagos = marcar_ingressos_pi_pagos(db, pi_id)
            if ingressos_recém_pagos:
                logger.info(
                    "Ingressos pagos via webhook PI %s: %s",
                    pi_id,
                    ", ".join(ingressos_recém_pagos),
                )

        elif event_type == "payment_intent.payment_failed":
            payment_intent = event["data"]["object"]
            n = cancelar_ingressos_pi_pendentes(db, payment_intent["id"])
            if n:
                logger.info(
                    "Ingressos cancelados (pagamento falhou) PI %s: %d",
                    payment_intent["id"],
                    n,
                )

        elif event_type == "payment_intent.canceled":
            payment_intent = event["data"]["object"]
            n = cancelar_ingressos_pi_pendentes(db, payment_intent["id"])
            if n:
                logger.info(
                    "Ingressos cancelados (PI expirado) %s: %d",
                    payment_intent["id"],
                    n,
                )

        if event_id:
            db.add(StripeEvent(id=event_id, tipo=event_type))
        db.commit()
        for iid in ingressos_recém_pagos:
            notificar_ingresso_pago(iid)
    except IntegrityError:
        db.rollback()
        logger.info("Webhook duplicado (race): %s", event_id)
        return {"status": "success", "idempotent": True}

    return {"status": "success"}


@router.post("/mock-payment")
async def mock_payment(ingresso_id: str, db: Session = Depends(get_db)):
    """(Apenas para Desenvolvimento) Simula a aprovação de um pagamento sem precisar do Stripe CLI"""
    if (
        settings.ENVIRONMENT == "production"
        or not settings.DEBUG
        or settings.ENVIRONMENT != "development"
    ):
        raise HTTPException(
            status_code=403, detail="Apenas permitido em ambiente de desenvolvimento"
        )

    ingresso = db.query(Ingresso).filter(Ingresso.id == ingresso_id).first()
    if not ingresso:
        raise HTTPException(status_code=404, detail="Ingresso não encontrado")

    if marcar_ingresso_pago(db, ingresso):
        db.commit()
        notificar_ingresso_pago(ingresso.id)
    else:
        db.commit()
    logger.info(
        "Ingresso %s pago com sucesso via MOCK (Stripe CLI ignorado)!", ingresso.id
    )

    return {
        "status": "success",
        "mensagem": f"Pagamento do ingresso {ingresso.id} simulado com sucesso",
    }
