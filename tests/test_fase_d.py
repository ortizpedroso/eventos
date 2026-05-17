"""Fase D: fila de e-mail resiliente e fluxo de compra (API)."""

from __future__ import annotations

import uuid
from unittest.mock import patch

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


def _registrar_cliente(suffix: str) -> str:
    r = client.post(
        "/api/auth/registrar",
        json={
            "email": f"cli_d_{suffix}@test.com",
            "nome": "Comprador",
            "senha": "senha12345",
            "tipo": "cliente",
        },
    )
    assert r.status_code == 200
    return r.json()["access_token"]


def _registrar_organizador(suffix: str) -> str:
    r = client.post(
        "/api/auth/registrar",
        json={
            "email": f"org_d_{suffix}@test.com",
            "nome": "Org",
            "senha": "senha12345",
            "tipo": "organizador",
        },
    )
    assert r.status_code == 200
    return r.json()["access_token"]


def _criar_evento(org_token: str) -> dict:
    r = client.post(
        "/api/eventos/criar",
        headers={"Authorization": f"Bearer {org_token}"},
        json={
            "nome": f"Show {uuid.uuid4().hex[:6]}",
            "descricao": "Teste fase D",
            "data_inicio": "2026-12-01T10:00:00",
            "data_fim": "2026-12-01T22:00:00",
            "local": "SP",
            "preco_ingresso": 50,
            "categoria": "Outros",
            "ingresso_lotes": [{"nome": "Geral", "preco": 50, "ordem": 1, "ativo": True}],
        },
    )
    assert r.status_code == 200, r.text
    return r.json()


class TestFluxoCompra:
    def test_compra_stripe_disabled_ingresso_pago_e_email_enfileirado(self):
        org = _registrar_organizador("fluxo1")
        cli = _registrar_cliente("fluxo1")
        ev = _criar_evento(org)

        prev = settings.STRIPE_DISABLED
        settings.STRIPE_DISABLED = True
        try:
            with patch("app.routes.pagamentos.enqueue_ticket_email") as mock_mail:
                r = client.post(
                    "/api/pagamentos/criar",
                    headers={"Authorization": f"Bearer {cli}"},
                    json={
                        "evento_id": ev["id"],
                        "valor_centavos": 5000,
                        "participante_nome": "Maria Teste",
                        "participante_email": "maria@test.com",
                        "participante_cpf": "52998224725",
                        "participante_telefone": "11999999999",
                    },
                )
                assert r.status_code == 200, r.text
                body = r.json()
                assert body.get("stripe_disabled") is True
                ingresso_id = body["ingresso_id"]
                mock_mail.assert_called_once_with(ingresso_id)

            meus = client.get(
                "/api/ingressos/meus",
                headers={"Authorization": f"Bearer {cli}"},
            )
            assert meus.status_code == 200
            lista = meus.json()
            ing = next((i for i in lista if i["id"] == ingresso_id), None)
            assert ing is not None, "Ingresso não apareceu em /ingressos/meus"
            assert ing["status"] == "pago"
            assert ing.get("participante_email") == "maria@test.com"
        finally:
            settings.STRIPE_DISABLED = prev
