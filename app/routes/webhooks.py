import json
import logging
import secrets
from fastapi import APIRouter, Request, HTTPException, Depends
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models import Ingresso, WebhookEvent, get_db
from app.services.asaas_client import AsaasAPIError
from app.services.ingresso_pago import (
    cancelar_ingressos_pi_pendentes,
    cancelar_ingressos_reembolsados,
    marcar_ingresso_pago,
    notificar_ingresso_pago,
    processar_cobranca_confirmada_gateway,
)
from config.settings import settings

logger = logging.getLogger(__name__)
router = APIRouter()


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
        existente = db.get(WebhookEvent, event_id)
        if existente:
            return {"status": "success", "idempotent": True}

    ingressos_recém_pagos: list[str] = []
    try:
        if event_type in ("PAYMENT_RECEIVED", "PAYMENT_CONFIRMED") and pay_id:
            from app.services.assinatura_organizador import processar_pagamento_assinatura_gateway

            if payment and processar_pagamento_assinatura_gateway(db, payment):
                pass
            else:
                ingressos_recém_pagos = processar_cobranca_confirmada_gateway(
                    db,
                    pay_id,
                    payment=payment,
                    raise_on_gateway_error=True,
                )
        elif event_type == "PAYMENT_REFUNDED" and pay_id:
            cancelar_ingressos_reembolsados(db, pay_id)
        elif event_type in ("PAYMENT_DELETED", "PAYMENT_OVERDUE") and pay_id:
            cancelar_ingressos_pi_pendentes(db, pay_id)

        if event_id:
            db.add(WebhookEvent(id=event_id, tipo=event_type))
        db.commit()
        for iid in ingressos_recém_pagos:
            notificar_ingresso_pago(iid)
    except AsaasAPIError:
        db.rollback()
        logger.error("Webhook Asaas: gateway indisponível para pagamento %s", pay_id)
        raise HTTPException(status_code=503, detail="Payment gateway unavailable") from None
    except IntegrityError:
        db.rollback()
        return {"status": "success", "idempotent": True}

    return {"status": "success"}


@router.post("/mock-payment")
async def mock_payment(ingresso_id: str, db: Session = Depends(get_db)):
    """(Apenas para Desenvolvimento) Simula a aprovação de um pagamento."""
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
    logger.info("Ingresso %s pago com sucesso via MOCK!", ingresso.id)

    return {
        "status": "success",
        "mensagem": f"Pagamento do ingresso {ingresso.id} simulado com sucesso",
    }
