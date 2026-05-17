"""Fase B: limite CPF, cortesia, check-in."""

from __future__ import annotations

import uuid
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.services.ingresso_checkin import codigo_checkin
from config.database import Base
from app.models import get_db
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


app.dependency_overrides[get_db] = override_get_db
client = TestClient(app)


@pytest.fixture(autouse=True)
def _stripe_mocks():
    with (
        patch("stripe.Customer.create") as customer_create,
        patch("stripe.PaymentIntent.create") as payment_intent_create,
    ):
        customer_create.return_value = type("Customer", (), {"id": "cus_test"})()
        payment_intent_create.return_value = type(
            "PaymentIntent",
            (),
            {"id": "pi_test", "client_secret": "sec_test"},
        )()
        yield


def _registrar_organizador(suffix: str) -> str:
    r = client.post(
        "/api/auth/registrar",
        json={
            "email": f"org_{suffix}@test.com",
            "nome": "Org",
            "senha": "senha12345",
            "tipo": "organizador",
        },
    )
    assert r.status_code == 200
    return r.json()["access_token"]


def _registrar_cliente(suffix: str) -> str:
    r = client.post(
        "/api/auth/registrar",
        json={
            "email": f"cli_{suffix}@test.com",
            "nome": "Cliente",
            "senha": "senha12345",
            "tipo": "cliente",
        },
    )
    assert r.status_code == 200
    return r.json()["access_token"]


def _criar_evento(org_token: str, **extra) -> dict:
    payload = {
        "nome": f"Evento {uuid.uuid4().hex[:6]}",
        "descricao": "Teste",
        "data_inicio": "2026-12-01T10:00:00",
        "data_fim": "2026-12-01T22:00:00",
        "local": "SP",
        "preco_ingresso": 50,
        "categoria": "Outros",
        "ingresso_lotes": [{"nome": "Geral", "preco": 50, "ordem": 1, "ativo": True}],
    }
    payload.update(extra)
    r = client.post(
        "/api/eventos/criar",
        headers={"Authorization": f"Bearer {org_token}"},
        json=payload,
    )
    assert r.status_code == 200, r.text
    return r.json()


class TestLimiteCpf:
    def test_limite_cpf_bloqueia_segunda_compra(self):
        org = _registrar_organizador("cpf1")
        cli = _registrar_cliente("cpf1")
        ev = _criar_evento(
            org,
            limite_ingressos_por_cpf=1,
            ingresso_lotes=[{"nome": "Geral", "preco": 50, "ordem": 1, "ativo": True}],
        )

        body = {
            "evento_id": ev["id"],
            "valor_centavos": 5000,
            "participante_cpf": "52998224725",
        }
        h = {"Authorization": f"Bearer {cli}"}
        r1 = client.post("/api/pagamentos/criar", headers=h, json=body)
        assert r1.status_code == 200

        r2 = client.post("/api/pagamentos/criar", headers=h, json=body)
        assert r2.status_code == 400
        assert "Limite" in r2.json()["detail"]


class TestCortesia:
    def test_cortesia_sem_stripe(self):
        org = _registrar_organizador("cort")
        cli = _registrar_cliente("cort")
        ev = _criar_evento(
            org,
            preco_ingresso=0.5,
            ingresso_lotes=[
                {"nome": "Cortesia", "tipo": "cortesia", "preco": 0, "ordem": 1, "ativo": True},
            ],
        )
        r = client.post(
            "/api/pagamentos/criar",
            headers={"Authorization": f"Bearer {cli}"},
            json={
                "evento_id": ev["id"],
                "valor_centavos": 0,
                "cortesia_responsavel": "Organizador Teste",
            },
        )
        assert r.status_code == 200
        data = r.json()
        assert data.get("stripe_disabled") is True
        assert data.get("cortesia") is True

    def test_cortesia_exige_responsavel(self):
        org = _registrar_organizador("cort2")
        cli = _registrar_cliente("cort2")
        ev = _criar_evento(
            org,
            ingresso_lotes=[
                {"nome": "Cortesia", "tipo": "cortesia", "preco": 0, "ordem": 1, "ativo": True},
            ],
        )
        r = client.post(
            "/api/pagamentos/criar",
            headers={"Authorization": f"Bearer {cli}"},
            json={"evento_id": ev["id"], "valor_centavos": 0},
        )
        assert r.status_code == 400
        assert "cortesia" in r.json()["detail"].lower()


class TestCheckin:
    def test_checkin_ingresso_pago(self):
        org = _registrar_organizador("chk")
        cli = _registrar_cliente("chk")
        ev = _criar_evento(org)

        from config.settings import settings

        prev = settings.STRIPE_DISABLED
        settings.STRIPE_DISABLED = True
        try:
            r = client.post(
                "/api/pagamentos/criar",
                headers={"Authorization": f"Bearer {cli}"},
                json={"evento_id": ev["id"], "valor_centavos": 5000},
            )
            assert r.status_code == 200, r.text
            iid = r.json()["ingresso_id"]
        finally:
            settings.STRIPE_DISABLED = prev

        codigo = codigo_checkin(iid)
        chk = client.post(
            "/api/checkin/validar",
            headers={"Authorization": f"Bearer {org}"},
            json={"codigo": codigo},
        )
        assert chk.status_code == 200
        assert chk.json()["ok"] is True
        assert chk.json()["ja_utilizado"] is False
