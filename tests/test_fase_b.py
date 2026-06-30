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
        "publicado": True,
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
            "termo_compra_aceito": True,
        }
        h = {"Authorization": f"Bearer {cli}"}
        r1 = client.post("/api/pagamentos/criar", headers=h, json=body)
        assert r1.status_code == 200

        r2 = client.post("/api/pagamentos/criar", headers=h, json=body)
        assert r2.status_code == 400
        assert "Limite" in r2.json()["detail"]


class TestTermoCompra:
    def test_termo_obrigatorio(self):
        suffix = uuid.uuid4().hex[:8]
        org = _registrar_organizador(suffix)
        cli = _registrar_cliente(suffix)
        ev = _criar_evento(org)
        r = client.post(
            "/api/pagamentos/criar",
            headers={"Authorization": f"Bearer {cli}"},
            json={"evento_id": ev["id"], "valor_centavos": 5000},
        )
        assert r.status_code == 400
        assert "termo" in r.json()["detail"].lower()


class TestCortesia:
    def test_cortesia_gratis(self):
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
                "termo_compra_aceito": True,
            },
        )
        assert r.status_code == 200
        data = r.json()
        assert data.get("cortesia") is True

    def test_cortesia_default_responsavel(self):
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
            json={"evento_id": ev["id"], "valor_centavos": 0, "termo_compra_aceito": True},
        )
        assert r.status_code == 200
        assert r.json().get("cortesia") is True


class TestCheckin:
    def test_checkin_ingresso_pago(self):
        org = _registrar_organizador("chk")
        cli = _registrar_cliente("chk")
        ev = _criar_evento(org)

        from config.settings import settings

        prev = settings.ASAAS_DISABLED
        settings.ASAAS_DISABLED = True
        try:
            r = client.post(
                "/api/pagamentos/criar",
                headers={"Authorization": f"Bearer {cli}"},
                json={"evento_id": ev["id"], "valor_centavos": 5000, "termo_compra_aceito": True},
            )
            assert r.status_code == 200, r.text
            iid = r.json()["ingresso_id"]
        finally:
            settings.ASAAS_DISABLED = prev

        codigo = codigo_checkin(iid)
        chk = client.post(
            "/api/checkin/validar",
            headers={"Authorization": f"Bearer {org}"},
            json={"codigo": codigo},
        )
        assert chk.status_code == 200
        assert chk.json()["ok"] is True
        assert chk.json()["ja_utilizado"] is False

    def test_checkin_duplicado_retorna_ok_false(self):
        org = _registrar_organizador("chkdup")
        cli = _registrar_cliente("chkdup")
        ev = _criar_evento(org)

        from config.settings import settings

        prev = settings.ASAAS_DISABLED
        settings.ASAAS_DISABLED = True
        try:
            r = client.post(
                "/api/pagamentos/criar",
                headers={"Authorization": f"Bearer {cli}"},
                json={"evento_id": ev["id"], "valor_centavos": 5000, "termo_compra_aceito": True},
            )
            assert r.status_code == 200, r.text
            iid = r.json()["ingresso_id"]
        finally:
            settings.ASAAS_DISABLED = prev

        codigo = codigo_checkin(iid)
        chk1 = client.post(
            "/api/checkin/validar",
            headers={"Authorization": f"Bearer {org}"},
            json={"codigo": codigo},
        )
        assert chk1.status_code == 200
        assert chk1.json()["ok"] is True

        chk2 = client.post(
            "/api/checkin/validar",
            headers={"Authorization": f"Bearer {org}"},
            json={"codigo": codigo},
        )
        assert chk2.status_code == 200
        body = chk2.json()
        assert body["ok"] is False
        assert body["ja_utilizado"] is True

    def test_checkin_aceita_url_do_qr(self):
        from app.services.ingresso_checkin import extrair_ingresso_id
        from app.services.ingresso_qr import ingresso_qr_scan_url

        iid = str(uuid.uuid4())
        codigo = codigo_checkin(iid)
        url = ingresso_qr_scan_url(iid)

        assert extrair_ingresso_id(url) == iid
        assert extrair_ingresso_id(codigo) == iid

    def test_buscar_e_validar_por_id(self):
        org = _registrar_organizador("busca")
        cli = _registrar_cliente("busca")
        ev = _criar_evento(org)

        r = client.post(
            "/api/pagamentos/criar",
            headers={"Authorization": f"Bearer {cli}"},
            json={
                "evento_id": ev["id"],
                "valor_centavos": 5000,
                "participante_nome": "Ana Busca",
                "participante_email": "ana.busca@test.com",
                "participante_cpf": "52998224725",
                "participante_telefone": "11987654321",
                "termo_compra_aceito": True,
            },
        )
        assert r.status_code == 200, r.text
        iid = r.json()["ingresso_id"]

        busca = client.post(
            "/api/checkin/buscar",
            headers={"Authorization": f"Bearer {org}"},
            json={"q": "Ana Busca"},
        )
        assert busca.status_code == 200
        resultados = busca.json()["resultados"]
        assert len(resultados) >= 1
        assert any(x["ingresso_id"] == iid for x in resultados)

        chk = client.post(
            "/api/checkin/validar-id",
            headers={"Authorization": f"Bearer {org}"},
            json={"ingresso_id": iid},
        )
        assert chk.status_code == 200
        assert chk.json()["ok"] is True

    def test_portaria_buscar_por_nome(self):
        org = _registrar_organizador("pbusca")
        cli = _registrar_cliente("pbusca")
        ev = _criar_evento(org)

        r = client.post(
            "/api/pagamentos/criar",
            headers={"Authorization": f"Bearer {cli}"},
            json={
                "evento_id": ev["id"],
                "valor_centavos": 5000,
                "participante_nome": "Carlos Portaria",
                "participante_email": "carlos.port@test.com",
                "participante_cpf": "52998224725",
                "participante_telefone": "11987654321",
                "termo_compra_aceito": True,
            },
        )
        assert r.status_code == 200, r.text
        iid = r.json()["ingresso_id"]

        link = client.get(
            f"/api/eventos/id/{ev['id']}/link-portaria",
            headers={"Authorization": f"Bearer {org}"},
        )
        assert link.status_code == 200
        token = link.json()["token"]

        busca = client.post(
            "/api/portaria/buscar",
            json={"evento_id": ev["id"], "token": token, "q": "Carlos"},
        )
        assert busca.status_code == 200
        resultados = busca.json()["resultados"]
        assert any(x["ingresso_id"] == iid for x in resultados)

        chk = client.post(
            "/api/portaria/validar-id",
            json={"evento_id": ev["id"], "token": token, "ingresso_id": iid},
        )
        assert chk.status_code == 200
        assert chk.json()["ok"] is True
