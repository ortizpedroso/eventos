"""Respostas mock da API Asaas para testes E2E locais (sem sandbox real)."""

from __future__ import annotations

import uuid
from typing import Any

_MOCK_PAYMENTS: dict[str, dict[str, Any]] = {}


def _mock_enabled() -> bool:
    from config.settings import settings

    return settings.asaas_e2e_mock


def mock_criar_customer(payload: dict) -> dict[str, Any]:
    cid = f"cus_e2e_{uuid.uuid4().hex[:12]}"
    return {"id": cid, "name": payload.get("name"), "email": payload.get("email")}


def mock_criar_payment(payload: dict) -> dict[str, Any]:
    pid = f"pay_e2e_{uuid.uuid4().hex[:12]}"
    billing = (payload.get("billingType") or "PIX").upper()
    payment: dict[str, Any] = {
        "id": pid,
        "status": "PENDING",
        "billingType": billing,
        "value": payload.get("value"),
        "customer": payload.get("customer"),
        "externalReference": payload.get("externalReference"),
    }
    if billing == "PIX":
        payment["pixTransaction"] = {
            "encodedImage": "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
            "payload": f"00020126580014br.gov.bcb.pix0136e2e-mock-{pid}5204000053039865405{payload.get('value', 0):.2f}5802BR5925EventosBR E2E Mock6009SAO PAULO62070503***6304ABCD",
            "expirationDate": "2099-12-31T23:59:59",
        }
    if billing == "UNDEFINED":
        payment["invoiceUrl"] = "https://sandbox.asaas.com/i/e2e-mock-invoice"
    _MOCK_PAYMENTS[pid] = payment
    return payment


def mock_obter_payment(payment_id: str) -> dict[str, Any]:
    if payment_id in _MOCK_PAYMENTS:
        return _MOCK_PAYMENTS[payment_id]
    return {"id": payment_id, "status": "PENDING", "billingType": "PIX"}


def mock_request(method: str, path: str, *, json: dict | None = None) -> Any:
    if method == "POST" and path == "/v3/customers":
        return mock_criar_customer(json or {})
    if method == "POST" and path == "/v3/payments":
        return mock_criar_payment(json or {})
    if method == "GET" and path.startswith("/v3/payments/"):
        pid = path.rsplit("/", 1)[-1]
        return mock_obter_payment(pid)
    if method == "DELETE" and path.startswith("/v3/payments/"):
        pid = path.rsplit("/", 1)[-1]
        _MOCK_PAYMENTS.pop(pid, None)
        return {}
    return {}
