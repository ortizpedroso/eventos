import json
import logging
import stripe
from fastapi import APIRouter, Request, HTTPException, Depends
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models import Ingresso, StripeEvent, get_db
from app.services.ingresso_pago import marcar_ingresso_pago, notificar_ingresso_pago
from config.settings import settings

logger = logging.getLogger(__name__)
router = APIRouter()

_WEBHOOK_PLACEHOLDER = "whsec_seu_webhook_secret_aqui"


def _parse_stripe_webhook_event(payload: bytes, sig_header: str | None) -> dict:
    """Valida assinatura em produção; em dev permite JSON sem whsec configurado."""
    whsec = (settings.STRIPE_WEBHOOK_SECRET or "").strip()
    dev_sem_secret = (
        settings.DEBUG
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

    ingresso_recém_pago_id: str | None = None
    try:
        if event_type == "payment_intent.succeeded":
            payment_intent = event["data"]["object"]
            ingresso = (
                db.query(Ingresso)
                .filter(Ingresso.stripe_payment_intent_id == payment_intent["id"])
                .first()
            )
            if ingresso and marcar_ingresso_pago(db, ingresso):
                ingresso_recém_pago_id = ingresso.id
                logger.info("Ingresso %s pago via webhook", ingresso.id)

        elif event_type == "payment_intent.payment_failed":
            payment_intent = event["data"]["object"]
            ingresso = (
                db.query(Ingresso)
                .filter(Ingresso.stripe_payment_intent_id == payment_intent["id"])
                .first()
            )
            if ingresso and ingresso.status == "pendente":
                ingresso.status = "cancelado"
                logger.info("Ingresso %s cancelado (pagamento falhou)", ingresso.id)

        if event_id:
            db.add(StripeEvent(id=event_id, tipo=event_type))
        db.commit()
        if ingresso_recém_pago_id:
            notificar_ingresso_pago(ingresso_recém_pago_id)
    except IntegrityError:
        db.rollback()
        logger.info("Webhook duplicado (race): %s", event_id)
        return {"status": "success", "idempotent": True}

    return {"status": "success"}


@router.post("/mock-payment")
async def mock_payment(ingresso_id: str, db: Session = Depends(get_db)):
    """(Apenas para Desenvolvimento) Simula a aprovação de um pagamento sem precisar do Stripe CLI"""
    if not settings.DEBUG or getattr(settings, "ENVIRONMENT", "") != "development":
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
