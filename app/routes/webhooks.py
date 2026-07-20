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
        if event_type.startswith("ACCOUNT_STATUS_"):
            from app.services.organizador_asaas import aplicar_webhook_status_conta_asaas

            account = event.get("account") or {}
            account_id = str(account.get("id") or "")
            account_status = event.get("accountStatus") or {}
            if account_id and isinstance(account_status, dict):
                aplicar_webhook_status_conta_asaas(
                    db,
                    account_id=account_id,
                    account_status=account_status,
                    event_type=event_type,
                )
        elif event_type in ("PAYMENT_RECEIVED", "PAYMENT_CONFIRMED") and pay_id:
            from app.services.assinatura_organizador import processar_pagamento_assinatura_gateway

            if payment and processar_pagamento_assinatura_gateway(
                db, payment, raise_on_gateway_error=True
            ):
                pass
            else:
                ingressos_recém_pagos = processar_cobranca_confirmada_gateway(
                    db,
                    pay_id,
                    payment=payment,
                    raise_on_gateway_error=True,
                )
        elif event_type in ("PAYMENT_REFUNDED", "PAYMENT_REFUND_IN_PROGRESS") and pay_id:
            from app.services.assinatura_organizador import processar_reembolso_assinatura_gateway

            if not (payment and processar_reembolso_assinatura_gateway(db, payment)):
                cancelar_ingressos_reembolsados(db, pay_id)
        elif event_type in (
            "PAYMENT_CHARGEBACK_REQUESTED",
            "PAYMENT_CHARGEBACK_DISPUTE",
            "PAYMENT_AWAITING_CHARGEBACK_REVERSAL",
        ) and pay_id:
            from app.services.assinatura_organizador import processar_reembolso_assinatura_gateway

            logger.warning("Webhook chargeback Asaas: %s pagamento %s", event_type, pay_id)
            if not (payment and processar_reembolso_assinatura_gateway(db, payment)):
                cancelar_ingressos_reembolsados(db, pay_id)
        elif event_type in ("PAYMENT_DELETED", "PAYMENT_OVERDUE") and pay_id:
            from app.services.assinatura_organizador import limpar_renovacao_assinatura_pendente

            limpar_renovacao_assinatura_pendente(db, pay_id)
            cancelar_ingressos_pi_pendentes(db, pay_id)
        elif event_type.startswith("TRANSFER_"):
            from app.services.saque_asaas import aplicar_webhook_transferencia

            transfer = event.get("transfer") or {}
            aplicar_webhook_transferencia(db, transfer, event_type=event_type)

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


@router.post("/asaas/transfer-auth")
async def asaas_transfer_auth(request: Request, db: Session = Depends(get_db)):
    """Autorização de saques/transferências Asaas (BaaS — sem token SMS).

    O Asaas envia POST ~5s após criar a transferência. Resposta esperada:
    ``{"status": "APPROVED"}`` ou ``{"status": "REFUSED", "refuseReason": "..."}``.
  """
    payload_raw = await request.body()
    token_header = request.headers.get("asaas-access-token", "")
    _validar_token_webhook_asaas(token_header)

    try:
        body = json.loads(payload_raw.decode("utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as e:
        raise HTTPException(status_code=400, detail="Invalid payload") from e

    tipo = str(body.get("type") or "").strip().upper()
    if tipo != "TRANSFER":
        logger.warning("Autorização saque: tipo não suportado %s", tipo or "(vazio)")
        return {
            "status": "REFUSED",
            "refuseReason": "Tipo de operação não suportado pelo EventosBR.",
        }

    transfer = body.get("transfer") or {}
    if not isinstance(transfer, dict) or not transfer.get("id"):
        raise HTTPException(status_code=400, detail="Invalid transfer payload")

    from app.services.saque_asaas import autorizar_saque_transferencia

    try:
        resultado = autorizar_saque_transferencia(db, transfer)
        db.commit()
    except Exception:
        db.rollback()
        logger.exception("Autorização saque: falha ao processar transfer %s", transfer.get("id"))
        return {
            "status": "REFUSED",
            "refuseReason": "Erro interno ao validar a transferência.",
        }

    logger.info(
        "Autorização saque transfer %s → %s",
        transfer.get("id"),
        resultado.get("status"),
    )
    return resultado


@router.post("/mock-payment")
async def mock_payment(ingresso_id: str, db: Session = Depends(get_db)):
    """(Apenas para Desenvolvimento) Simula a aprovação de um pagamento."""
    if not (settings.ENVIRONMENT == "development" and settings.DEBUG):
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
