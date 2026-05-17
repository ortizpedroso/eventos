"""Fluxo webhook payment_intent.succeeded marca ingresso como pago."""

from __future__ import annotations

import json
import uuid
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.models import Ingresso, Usuario, get_db
from config.database import Base
from config.settings import settings
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

SQLALCHEMY_DATABASE_URL = "sqlite+pysqlite:///:memory:"
engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base.metadata.create_all(bind=engine)


def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture(autouse=True)
def _webhook_test_db():
    """Garante DB isolado mesmo quando a suíte roda outros módulos de teste."""
    app.dependency_overrides[get_db] = override_get_db
    yield
    app.dependency_overrides.pop(get_db, None)


client = TestClient(app)


def test_webhook_payment_intent_succeeded_marca_pago(monkeypatch):
    monkeypatch.setattr(settings, "STRIPE_WEBHOOK_SECRET", "whsec_test_flow")
    monkeypatch.setattr(settings, "DEBUG", True)
    monkeypatch.setattr(settings, "ENVIRONMENT", "development")

    suf = uuid.uuid4().hex[:6]
    org_email = f"org_wh_{suf}@test.com"
    cli_email = f"cli_wh_{suf}@test.com"

    client.post(
        "/api/auth/registrar",
        json={"email": org_email, "nome": "Org", "senha": "senha12345", "tipo": "organizador"},
    )
    client.post(
        "/api/auth/registrar",
        json={"email": cli_email, "nome": "Cli", "senha": "senha12345", "tipo": "cliente"},
    )
    org_token = client.post("/api/auth/login", json={"email": org_email, "senha": "senha12345"}).json()[
        "access_token"
    ]

    ev = client.post(
        "/api/eventos/criar",
        headers={"Authorization": f"Bearer {org_token}"},
        json={
            "nome": f"WH {suf}",
            "descricao": "x",
            "data_inicio": "2026-12-01T10:00:00",
            "data_fim": "2026-12-01T22:00:00",
            "local": "SP",
            "preco_ingresso": 25,
            "categoria": "Outros",
            "ingresso_lotes": [{"nome": "Geral", "preco": 25, "ordem": 1, "ativo": True}],
        },
    )
    assert ev.status_code == 200
    evento_id = ev.json()["id"]
    pi_id = f"pi_test_{suf}"

    db = TestingSessionLocal()
    try:
        usuario = db.query(Usuario).filter(Usuario.email == cli_email).first()
        ing = Ingresso(
            evento_id=evento_id,
            usuario_id=usuario.id,
            participante_nome="Test",
            participante_email=cli_email,
            valor=25.0,
            stripe_payment_intent_id=pi_id,
            status="pendente",
        )
        db.add(ing)
        db.commit()
        ingresso_id = ing.id
    finally:
        db.close()

    payload_dict = {
        "id": f"evt_{suf}",
        "type": "payment_intent.succeeded",
        "data": {"object": {"id": pi_id}},
    }
    payload = json.dumps(payload_dict).encode("utf-8")

    with (
        patch("stripe.Webhook.construct_event") as construct_event,
        patch("app.routes.webhooks.notificar_ingresso_pago") as notify,
    ):
        construct_event.return_value = payload_dict
        r = client.post(
            "/api/webhooks/stripe",
            data=payload,
            headers={"stripe-signature": "t=1,v1=test"},
        )
        assert r.status_code == 200, r.text
        notify.assert_called_once_with(ingresso_id)

    db = TestingSessionLocal()
    try:
        ing2 = db.query(Ingresso).filter(Ingresso.id == ingresso_id).first()
        assert ing2 is not None
        assert ing2.status == "pago"
    finally:
        db.close()
