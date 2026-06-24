"""Configuração de webhooks Asaas para subcontas white-label."""

from __future__ import annotations

from config.settings import settings


def url_webhook_asaas() -> str | None:
    base = (settings.FRONTEND_PUBLIC_URL or "").strip().rstrip("/")
    if not base or base.startswith("http://localhost"):
        api_base = base.replace(":3000", ":8000") if ":3000" in base else ""
        if api_base:
            return f"{api_base}/api/webhooks/asaas"
        return None
    return f"{base}/api/webhooks/asaas"


def webhooks_payload_subconta() -> list[dict]:
    """Webhooks recomendados na criação de subconta (white-label)."""
    url = url_webhook_asaas()
    token = (settings.ASAAS_WEBHOOK_TOKEN or "").strip()
    if not url or not token:
        return []

    eventos = [
        "PAYMENT_CREATED",
        "PAYMENT_UPDATED",
        "PAYMENT_CONFIRMED",
        "PAYMENT_RECEIVED",
        "PAYMENT_REFUNDED",
        "PAYMENT_DELETED",
        "PAYMENT_OVERDUE",
        "PAYMENT_CHARGEBACK_REQUESTED",
        "PAYMENT_CHARGEBACK_DISPUTE",
        "PAYMENT_AWAITING_CHARGEBACK_REVERSAL",
        "ACCOUNT_STATUS_GENERAL_APPROVAL_PENDING",
        "ACCOUNT_STATUS_GENERAL_APPROVAL_APPROVED",
        "ACCOUNT_STATUS_GENERAL_APPROVAL_REJECTED",
        "ACCOUNT_STATUS_COMMERCIAL_INFO_PENDING",
        "ACCOUNT_STATUS_COMMERCIAL_INFO_APPROVED",
        "ACCOUNT_STATUS_COMMERCIAL_INFO_REJECTED",
        "ACCOUNT_STATUS_DOCUMENT_PENDING",
        "ACCOUNT_STATUS_DOCUMENT_APPROVED",
        "ACCOUNT_STATUS_DOCUMENT_REJECTED",
        "ACCOUNT_STATUS_BANK_ACCOUNT_INFO_PENDING",
        "ACCOUNT_STATUS_BANK_ACCOUNT_INFO_APPROVED",
        "ACCOUNT_STATUS_BANK_ACCOUNT_INFO_REJECTED",
        "TRANSFER_CREATED",
        "TRANSFER_PENDING",
        "TRANSFER_IN_BANK_PROCESSING",
        "TRANSFER_DONE",
        "TRANSFER_FAILED",
        "TRANSFER_CANCELLED",
    ]
    return [
        {
            "name": "EventosBR — pagamentos e repasses",
            "url": url,
            "email": None,
            "sendType": "SEQUENTIALLY",
            "interrupted": False,
            "enabled": True,
            "apiVersion": 3,
            "authToken": token,
            "events": eventos,
        }
    ]
