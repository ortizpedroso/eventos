"""Cobranças, split e reembolso via Asaas."""

from __future__ import annotations

import logging
from datetime import date, timedelta
from typing import Any

from app.models import Evento, Ingresso, Usuario
from app.services.asaas_client import AsaasAPIError, get_asaas_client
from app.services.tarifas_plataforma import taxa_ingresso
from config.settings import settings

logger = logging.getLogger(__name__)

# Status Asaas que equivalem a pago
_ASAAS_PAGO = frozenset({"RECEIVED", "CONFIRMED", "RECEIVED_IN_CASH"})
_ASAAS_PENDENTE = frozenset({"PENDING", "OVERDUE"})
_ASAAS_CANCELADO = frozenset({"REFUNDED", "REFUND_REQUESTED", "CHARGEBACK_REQUESTED", "CHARGEBACK_DISPUTE", "AWAITING_CHARGEBACK_REVERSAL", "DUNNING_REQUESTED", "DUNNING_RECEIVED", "DELETED"})


def ingresso_payment_ref(ingresso: Ingresso) -> str:
    """ID externo do pagamento (Asaas ou Stripe)."""
    if ingresso.asaas_payment_id:
        return ingresso.asaas_payment_id
    return (ingresso.stripe_payment_intent_id or "").strip()


def split_para_evento(evento: Evento, valor_reais: float) -> list[dict[str, Any]]:
    """Split: taxa plataforma (fixo) + líquido organizador (fixo)."""
    splits: list[dict[str, Any]] = []
    taxa = round(taxa_ingresso(valor_reais), 2)
    liquido = round(max(0.0, valor_reais - taxa), 2)
    org_wallet = (evento.asaas_wallet_id or "").strip()
    platform_wallet = (settings.ASAAS_PLATFORM_WALLET_ID or "").strip()

    if org_wallet and liquido > 0:
        splits.append({"walletId": org_wallet, "fixedValue": liquido})
    if platform_wallet and taxa > 0:
        splits.append({"walletId": platform_wallet, "fixedValue": taxa})
    return splits


def criar_cobranca_asaas(
    *,
    customer_id: str,
    valor_reais: float,
    billing_type: str,
    external_reference: str,
    descricao: str,
    evento: Evento,
    credit_card: dict | None = None,
    credit_card_holder_info: dict | None = None,
    remote_ip: str | None = None,
    installment_count: int | None = None,
) -> dict[str, Any]:
    client = get_asaas_client()
    due = (date.today() + timedelta(days=1)).isoformat()
    payload: dict[str, Any] = {
        "customer": customer_id,
        "billingType": billing_type,
        "value": round(valor_reais, 2),
        "dueDate": due,
        "description": descricao[:500],
        "externalReference": external_reference[:100],
    }
    splits = split_para_evento(evento, valor_reais)
    if splits:
        payload["split"] = splits

    if billing_type == "CREDIT_CARD" and credit_card and credit_card_holder_info:
        payload["creditCard"] = credit_card
        payload["creditCardHolderInfo"] = credit_card_holder_info
        if remote_ip:
            payload["remoteIp"] = remote_ip
        if installment_count and installment_count > 1:
            payload["installmentCount"] = installment_count

    return client.post("/v3/payments", json=payload)


def obter_cobranca(payment_id: str) -> dict[str, Any]:
    return get_asaas_client().get(f"/v3/payments/{payment_id}")


def cancelar_cobranca_pendente(payment_id: str) -> None:
    try:
        get_asaas_client().delete(f"/v3/payments/{payment_id}")
    except AsaasAPIError as e:
        if e.status_code == 404:
            return
        logger.warning("Não foi possível cancelar cobrança Asaas %s: %s", payment_id, e)


def reembolsar_cobranca(payment_id: str) -> dict[str, Any]:
    return get_asaas_client().post(f"/v3/payments/{payment_id}/refund")


def status_eh_pago(status: str | None) -> bool:
    return (status or "").upper() in _ASAAS_PAGO


def status_eh_cancelado(status: str | None) -> bool:
    return (status or "").upper() in _ASAAS_CANCELADO


def extrair_pix(payment: dict[str, Any]) -> dict[str, Any] | None:
    pix = payment.get("pixTransaction") or {}
    encoded = pix.get("encodedImage") or payment.get("encodedImage")
    copia = pix.get("payload") or payment.get("pixCopiaECola") or payment.get("payload")
    if not encoded and not copia:
        return None
    return {
        "encoded_image": encoded,
        "copia_cola": copia,
        "expiration_date": pix.get("expirationDate") or payment.get("expirationDate"),
    }


def resposta_checkout_asaas(payment: dict[str, Any]) -> dict[str, Any]:
    """Normaliza resposta para o frontend."""
    out: dict[str, Any] = {
        "payment_provider": "asaas",
        "payment_id": payment.get("id"),
        "invoice_url": payment.get("invoiceUrl"),
        "status": payment.get("status"),
        "pix_disponivel": payment.get("billingType") == "PIX",
    }
    pix = extrair_pix(payment)
    if pix:
        out["pix"] = pix
    return out
