"""Fase C: cupons, validação no checkout e comunicados."""

from __future__ import annotations

import uuid
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.models import get_db
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
            "email": f"org_c_{suffix}@test.com",
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
            "email": f"cli_c_{suffix}@test.com",
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


class TestCupons:
    def test_criar_e_validar_cupom_percentual(self):
        org = _registrar_organizador("cup1")
        cli = _registrar_cliente("cup1")
        ev = _criar_evento(org)

        cr = client.post(
            f"/api/eventos/id/{ev['id']}/cupons",
            headers={"Authorization": f"Bearer {org}"},
            json={"codigo": "PROMO10", "tipo": "percentual", "valor": 0.1, "ativo": True},
        )
        assert cr.status_code == 200, cr.text
        assert cr.json()["codigo"] == "PROMO10"

        val = client.post(
            "/api/pagamentos/validar-cupom",
            headers={"Authorization": f"Bearer {cli}"},
            json={"evento_id": ev["id"], "codigo_cupom": "promo10"},
        )
        assert val.status_code == 200, val.text
        data = val.json()
        assert data["valor_centavos"] == 4500
        assert data["desconto_centavos"] == 500

    def test_criar_pagamento_com_cupom(self):
        org = _registrar_organizador("cup2")
        cli = _registrar_cliente("cup2")
        ev = _criar_evento(org)
        client.post(
            f"/api/eventos/id/{ev['id']}/cupons",
            headers={"Authorization": f"Bearer {org}"},
            json={"codigo": "DESC20", "tipo": "percentual", "valor": 0.2, "ativo": True},
        )

        prev = settings.STRIPE_DISABLED
        settings.STRIPE_DISABLED = True
        try:
            r = client.post(
                "/api/pagamentos/criar",
                headers={"Authorization": f"Bearer {cli}"},
                json={
                    "evento_id": ev["id"],
                    "valor_centavos": 4000,
                    "codigo_cupom": "DESC20",
                    "termo_compra_aceito": True,
                },
            )
            assert r.status_code == 200, r.text
        finally:
            settings.STRIPE_DISABLED = prev

        bad = client.post(
            "/api/pagamentos/criar",
            headers={"Authorization": f"Bearer {cli}"},
            json={
                "evento_id": ev["id"],
                "valor_centavos": 5000,
                "codigo_cupom": "DESC20",
                "termo_compra_aceito": True,
            },
        )
        assert bad.status_code == 400


class TestComunicados:
    def test_comunicado_enfileira_para_pagos(self):
        org = _registrar_organizador("com1")
        cli = _registrar_cliente("com1")
        ev = _criar_evento(org)

        prev = settings.STRIPE_DISABLED
        settings.STRIPE_DISABLED = True
        try:
            ing = client.post(
                "/api/pagamentos/criar",
                headers={"Authorization": f"Bearer {cli}"},
                json={"evento_id": ev["id"], "valor_centavos": 5000, "termo_compra_aceito": True},
            )
            assert ing.status_code == 200, ing.text
        finally:
            settings.STRIPE_DISABLED = prev

        with patch(
            "app.routes.organizador.enqueue_comunicado_evento",
            return_value=1,
        ) as mock_enqueue:
            r = client.post(
                "/api/organizador/comunicados",
                headers={"Authorization": f"Bearer {org}"},
                json={
                    "evento_id": ev["id"],
                    "assunto": "Aviso importante",
                    "mensagem": "Mensagem de teste para participantes.",
                },
            )
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["destinatarios"] >= 1
        assert body["enfileirados"] == 1
        mock_enqueue.assert_called_once()


class TestRelatoriosMetricas:
    def test_relatorio_inclui_vagas_e_conversao(self):
        org = _registrar_organizador("met1")
        ev = _criar_evento(
            org,
            ingresso_lotes=[
                {
                    "nome": "Geral",
                    "preco": 50,
                    "ordem": 1,
                    "ativo": True,
                    "quantidade_maxima": 100,
                },
            ],
        )
        r = client.get(
            "/api/relatorios/organizador",
            headers={"Authorization": f"Bearer {org}"},
        )
        assert r.status_code == 200, r.text
        por = r.json()["por_evento"]
        row = next(x for x in por if x["evento_id"] == ev["id"])
        assert row["vagas_restantes"] == 100
        assert row["conversao_pct"] is None
