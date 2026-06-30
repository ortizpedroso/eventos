"""Testes do webhook de autorização de saques Asaas (BaaS / sem SMS)."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from fastapi.testclient import TestClient

from app.models import FinanceiroSaque, Usuario, get_db
from app.services.saque_asaas import autorizar_saque_transferencia
from app.utils.secret_storage import encrypt_at_rest
from config.settings import settings
from tests import test_api


def _db():
    return test_api.TestingSessionLocal()


def _org(db) -> Usuario:
    org = Usuario(
        email=f"org-auth-{uuid.uuid4().hex[:8]}@ex.com",
        nome="Org Auth",
        senha_hash="x",
        tipo="organizador",
        asaas_wallet_id=f"wallet_{uuid.uuid4().hex[:8]}",
        asaas_account_id=f"acc_{uuid.uuid4().hex[:8]}",
        asaas_repasse_status="approved",
        asaas_subaccount_api_key=encrypt_at_rest("key_test_auth"),
    )
    db.add(org)
    db.commit()
    db.refresh(org)
    return org


def _saque(
    db,
    org: Usuario,
    *,
    valor: float = 50.0,
    status: str = "processando",
    transfer_id: str | None = "tra_auth_1",
) -> FinanceiroSaque:
    agora = datetime.now(timezone.utc).replace(tzinfo=None)
    saque = FinanceiroSaque(
        organizador_id=org.id,
        valor=valor,
        pix_chave="teste@exemplo.com",
        pix_tipo="EMAIL",
        status=status,
        asaas_transfer_id=transfer_id,
        criado_em=agora,
        atualizado_em=agora,
    )
    db.add(saque)
    db.commit()
    db.refresh(saque)
    return saque


def test_autorizar_saque_aprovado_por_transfer_id():
    db = _db()
    try:
        org = _org(db)
        tid = f"tra_{uuid.uuid4().hex[:8]}"
        saque = _saque(db, org, valor=75.5, transfer_id=tid)

        resultado = autorizar_saque_transferencia(
            db,
            {
                "id": tid,
                "value": 75.5,
                "externalReference": saque.id,
                "status": "PENDING",
            },
        )
        assert resultado == {"status": "APPROVED"}
    finally:
        db.close()


def test_autorizar_saque_aprovado_por_external_reference():
    db = _db()
    try:
        org = _org(db)
        saque = _saque(db, org, transfer_id=None)

        resultado = autorizar_saque_transferencia(
            db,
            {
                "id": "tra_novo",
                "value": 50.0,
                "externalReference": saque.id,
            },
        )
        assert resultado == {"status": "APPROVED"}
        db.commit()
        db.refresh(saque)
        assert saque.asaas_transfer_id == "tra_novo"
    finally:
        db.close()


def test_autorizar_saque_recusa_valor_divergente():
    db = _db()
    try:
        org = _org(db)
        tid = f"tra_{uuid.uuid4().hex[:8]}"
        _saque(db, org, valor=50.0, transfer_id=tid)

        resultado = autorizar_saque_transferencia(
            db,
            {"id": tid, "value": 49.99},
        )
        assert resultado["status"] == "REFUSED"
        assert "valor" in resultado["refuseReason"].lower()
    finally:
        db.close()


def test_autorizar_saque_recusa_nao_encontrado():
    db = _db()
    try:
        resultado = autorizar_saque_transferencia(
            db,
            {"id": "tra_inexistente", "value": 10.0},
        )
        assert resultado["status"] == "REFUSED"
    finally:
        db.close()


def test_webhook_transfer_auth_endpoint():
    db = _db()
    try:
        org = _org(db)
        tid = f"tra_{uuid.uuid4().hex[:12]}"
        valor = round(50.0 + int(uuid.uuid4().hex[:2], 16) / 100, 2)
        saque = _saque(db, org, valor=valor, transfer_id=tid)
        db.refresh(saque)
        assert float(saque.valor) == valor

        def _override_db():
            try:
                yield db
            finally:
                pass

        prev_override = test_api.app.dependency_overrides.get(get_db)
        test_api.app.dependency_overrides[get_db] = _override_db
        try:
            client = TestClient(test_api.app)
            token = (settings.ASAAS_WEBHOOK_TOKEN or "test-webhook-token").strip()
            if not settings.ASAAS_WEBHOOK_TOKEN:
                settings.ASAAS_WEBHOOK_TOKEN = token

            resp = client.post(
                "/api/webhooks/asaas/transfer-auth",
                json={
                    "type": "TRANSFER",
                    "transfer": {
                        "id": tid,
                        "value": valor,
                        "externalReference": saque.id,
                        "status": "PENDING",
                    },
                },
                headers={"asaas-access-token": token},
            )
            assert resp.status_code == 200, resp.text
            assert resp.json() == {"status": "APPROVED"}
        finally:
            if prev_override is not None:
                test_api.app.dependency_overrides[get_db] = prev_override
            else:
                test_api.app.dependency_overrides.pop(get_db, None)
    finally:
        db.close()


def test_webhook_transfer_auth_token_invalido():
    client = TestClient(test_api.app)
    token = (settings.ASAAS_WEBHOOK_TOKEN or "test-webhook-token").strip()
    if not settings.ASAAS_WEBHOOK_TOKEN:
        settings.ASAAS_WEBHOOK_TOKEN = token

    resp = client.post(
        "/api/webhooks/asaas/transfer-auth",
        json={"type": "TRANSFER", "transfer": {"id": "x", "value": 1}},
        headers={"asaas-access-token": "token-errado"},
    )
    assert resp.status_code == 401
