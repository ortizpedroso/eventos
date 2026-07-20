"""Respostas mock da API Asaas para testes E2E locais (sem sandbox real)."""

from __future__ import annotations

import base64
import io
import uuid
from typing import Any

_MOCK_PAYMENTS: dict[str, dict[str, Any]] = {}
_MOCK_PAYMENT_CREATE_PAYLOADS: dict[str, dict[str, Any]] = {}


def mock_payment_create_payload(payment_id: str) -> dict[str, Any] | None:
    """Payload enviado ao POST /v3/payments (inclui split) — para testes."""
    return _MOCK_PAYMENT_CREATE_PAYLOADS.get(payment_id)


def mock_reset() -> None:
    _MOCK_PAYMENTS.clear()
    _MOCK_PAYMENT_CREATE_PAYLOADS.clear()


def _mock_pix_qr_base64(payload: str) -> str:
    """QR Code visualmente real (mesma lib usada nos ingressos) para telas de teste/demo."""
    try:
        import qrcode
        from qrcode.constants import ERROR_CORRECT_M

        qr = qrcode.QRCode(error_correction=ERROR_CORRECT_M, box_size=8, border=2)
        qr.add_data(payload)
        qr.make(fit=True)
        img = qr.make_image(fill_color="black", back_color="white")
        buf = io.BytesIO()
        img.save(buf, format="PNG")
        return base64.b64encode(buf.getvalue()).decode("ascii")
    except Exception:
        # 1x1 PNG como último recurso — não deve ocorrer em dev com qrcode instalado.
        return "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="


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
        pix_payload = (
            f"00020126580014br.gov.bcb.pix0136e2e-mock-{pid}5204000053039865405"
            f"{payload.get('value', 0):.2f}5802BR5925EventosBR E2E Mock6009SAO PAULO62070503***6304ABCD"
        )
        payment["pixTransaction"] = {
            "encodedImage": _mock_pix_qr_base64(pix_payload),
            "payload": pix_payload,
            "expirationDate": "2099-12-31T23:59:59",
        }
    if billing == "UNDEFINED":
        payment["invoiceUrl"] = "https://sandbox.asaas.com/i/e2e-mock-invoice"
    payment["split"] = list(payload.get("split") or [])
    _MOCK_PAYMENTS[pid] = payment
    _MOCK_PAYMENT_CREATE_PAYLOADS[pid] = dict(payload)
    return payment


def mock_obter_payment(payment_id: str) -> dict[str, Any]:
    if payment_id in _MOCK_PAYMENTS:
        return _MOCK_PAYMENTS[payment_id]
    return {"id": payment_id, "status": "PENDING", "billingType": "PIX"}


_MOCK_TRANSFERS: dict[str, dict[str, Any]] = {}


def mock_criar_transfer(payload: dict) -> dict[str, Any]:
    tid = f"tra_e2e_{uuid.uuid4().hex[:12]}"
    transfer = {
        "id": tid,
        "status": "PENDING",
        "value": payload.get("value"),
        "pixAddressKey": payload.get("pixAddressKey"),
        "externalReference": payload.get("externalReference"),
    }
    _MOCK_TRANSFERS[tid] = transfer
    return transfer


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
    if method == "POST" and path == "/v3/accounts":
        aid = f"acc_e2e_{uuid.uuid4().hex[:12]}"
        wid = f"wallet_e2e_{uuid.uuid4().hex[:12]}"
        return {
            "id": aid,
            "walletId": wid,
            "apiKey": f"key_e2e_{uuid.uuid4().hex[:16]}",
        }
    if method == "GET" and path == "/v3/myAccount/status":
        return {
            "commercialInfo": "APPROVED",
            "bankAccountInfo": "APPROVED",
            "documentation": "APPROVED",
            "general": "APPROVED",
        }
    if method == "GET" and path == "/v3/myAccount":
        return {
            "id": "acc_e2e_mock",
            "walletId": "wallet_e2e_mock",
            "name": "Organizador E2E Mock",
        }
    if method == "POST" and path == "/v3/transfers":
        return mock_criar_transfer(json or {})
    if method == "GET" and path == "/v3/finance/balance":
        return {"balance": 500.0}
    if method == "DELETE" and path.startswith("/v3/transfers/"):
        tid = path.rsplit("/", 1)[-1]
        _MOCK_TRANSFERS.pop(tid, None)
        return {}
    if method == "GET" and path.startswith("/v3/transfers/"):
        tid = path.rsplit("/", 1)[-1]
        return _MOCK_TRANSFERS.get(tid, {"id": tid, "status": "PENDING"})
    return {}
