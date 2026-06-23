"""Repasse Asaas: produção, webhooks e restrições."""

from __future__ import annotations

import json
import uuid
from unittest.mock import patch

from fastapi.testclient import TestClient

from app.main import app
from app.models import Usuario, get_db
from config.database import Base
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

engine = create_engine(
    "sqlite+pysqlite:///:memory:",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
Session = sessionmaker(bind=engine)
Base.metadata.create_all(bind=engine)


def _override_db():
    db = Session()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = _override_db
client = TestClient(app)


def _registrar_org(suffix: str) -> str:
    r = client.post(
        "/api/auth/registrar",
        json={
            "email": f"org_prod_{suffix}@test.com",
            "nome": "Org Prod",
            "senha": "senha12345",
            "tipo": "organizador",
        },
    )
    assert r.status_code == 200
    return r.json()["access_token"]


def test_wallet_manual_bloqueado_sem_flag():
    token = _registrar_org("wal")
    wallet = str(uuid.uuid4())
    with (
        patch("app.routes.organizador.settings") as route_settings,
        patch("app.services.organizador_asaas.settings") as svc_settings,
        patch("config.settings.settings") as global_settings,
    ):
        route_settings.payments_disabled = False
        route_settings.use_asaas = True
        route_settings.asaas_allow_manual_wallet = False
        svc_settings.use_asaas = True
        svc_settings.asaas_allow_manual_wallet = False
        global_settings.asaas_allow_manual_wallet = False
        global_settings.use_asaas = True
        r = client.put(
            "/api/organizador/asaas/wallet",
            headers={"Authorization": f"Bearer {token}"},
            json={"wallet_id": wallet},
        )
    assert r.status_code == 403


def test_wallet_manual_admin_override():
    token = _registrar_org("adm")
    wallet = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"
    with (
        patch("app.routes.organizador.settings") as route_settings,
        patch("app.services.organizador_asaas.settings") as svc_settings,
        patch("app.deps.platform_admin.settings") as admin_settings,
    ):
        route_settings.payments_disabled = False
        route_settings.use_asaas = True
        route_settings.asaas_allow_manual_wallet = False
        svc_settings.use_asaas = True
        svc_settings.asaas_allow_manual_wallet = False
        admin_settings.PLATFORM_ADMIN_API_KEY = "admin-key-test"
        r = client.put(
            "/api/organizador/asaas/wallet",
            headers={
                "Authorization": f"Bearer {token}",
                "X-Platform-Admin-Key": "admin-key-test",
            },
            json={"wallet_id": wallet},
        )
    assert r.status_code == 200, r.text


def test_webhook_account_status_aprova_organizador():
    reg = client.post(
        "/api/auth/registrar",
        json={
            "email": f"org_prod_wh_{uuid.uuid4().hex[:8]}@test.com",
            "nome": "Org Prod",
            "senha": "senha12345",
            "tipo": "organizador",
        },
    )
    assert reg.status_code == 200
    email = reg.json()["usuario"]["email"]

    gen = app.dependency_overrides[get_db]()
    db = next(gen)
    try:
        org = db.query(Usuario).filter(Usuario.email == email).first()
        assert org is not None
        org.asaas_account_id = "acc_webhook_test"
        org.asaas_wallet_id = "wallet_wh"
        org.asaas_repasse_status = "pending"
        db.commit()
    finally:
        try:
            next(gen)
        except StopIteration:
            pass

    payload = {
        "id": f"evt_{uuid.uuid4().hex[:12]}",
        "event": "ACCOUNT_STATUS_GENERAL_APPROVAL_APPROVED",
        "account": {"id": "acc_webhook_test"},
        "accountStatus": {
            "commercialInfo": "APPROVED",
            "bankAccountInfo": "APPROVED",
            "documentation": "APPROVED",
            "general": "APPROVED",
        },
    }
    with patch("app.routes.webhooks.settings") as wh_settings:
        wh_settings.ASAAS_WEBHOOK_TOKEN = "wh-token"
        wh_settings.ENVIRONMENT = "test"
        r = client.post(
            "/api/webhooks/asaas",
            headers={
                "asaas-access-token": "wh-token",
                "content-type": "application/json",
            },
            data=json.dumps(payload),
        )
    assert r.status_code == 200, r.text

    gen2 = app.dependency_overrides[get_db]()
    db2 = next(gen2)
    try:
        org = db2.query(Usuario).filter(Usuario.email == email).first()
        assert org is not None
        assert org.asaas_repasse_status == "approved"
    finally:
        try:
            next(gen2)
        except StopIteration:
            pass


def test_manual_nao_aprovado_quando_flag_desligada():
    from app.services.evento_repasse import repasse_status_aprovado

    with patch("app.services.evento_repasse.settings") as s:
        s.asaas_allow_manual_wallet = False
        assert repasse_status_aprovado("manual") is False
        assert repasse_status_aprovado("approved") is True
