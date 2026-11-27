"""Critérios para um evento aparecer na vitrine da EventosBR."""

from __future__ import annotations

import uuid
from contextlib import contextmanager
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.models import Usuario, get_db
from config.settings import settings
from tests import test_api

ADMIN = {"X-Platform-Admin-Key": "chave-admin-teste"}
CAPA = "/uploads/eventos/capa.webp"


@pytest.fixture(autouse=True)
def _admin(monkeypatch):
    monkeypatch.setattr(settings, "PLATFORM_ADMIN_API_KEY", "chave-admin-teste")


@contextmanager
def _db():
    gen = app.dependency_overrides[get_db]()
    db = next(gen)
    try:
        yield db
    finally:
        db.close()


def _organizador() -> tuple[dict[str, str], str]:
    reg = test_api.client.post(
        "/api/auth/registrar",
        json={"email": f"vit-{uuid.uuid4().hex[:8]}@test.com", "nome": "Org", "senha": "senha12345", "tipo": "organizador"},
    )
    assert reg.status_code == 200, reg.text
    return {"Authorization": f"Bearer {reg.json()['access_token']}"}, reg.json()["usuario"]["id"]


def _criar(auth: dict[str, str], *, capa: str | None = CAPA) -> dict:
    nome = f"Show Vitrine {uuid.uuid4().hex[:8]}"
    r = test_api.client.post(
        "/api/eventos/criar",
        headers=auth,
        json={
            "nome": nome,
            "descricao": "Show ao vivo",
            "data_inicio": "2027-05-01T20:00:00",
            "data_fim": "2027-05-01T23:00:00",
            "local": "Curitiba",
            "cidade": "Curitiba",
            "imagem_url": capa,
            "preco_ingresso": 0,
            "categoria": "Outros",
            "contato_telefone": "41999990000",
            "contato_email": "c@show.com",
            "publicado": True,
            "ingresso_lotes": [{"nome": "Geral", "preco": 0, "ordem": 1, "ativo": True, "tipo": "cortesia"}],
        },
    )
    assert r.status_code == 200, r.text
    return r.json()


def _na_vitrine(evento: dict) -> bool:
    lista = TestClient(app).get("/api/eventos", params={"q": evento["nome"]}).json()
    return any(e["id"] == evento["id"] for e in lista)


def _link_funciona(evento: dict) -> bool:
    return TestClient(app).get(f"/api/eventos/{evento['slug']}").status_code == 200


def test_evento_completo_de_organizador_confirmado_aparece():
    auth, _ = _organizador()
    assert _na_vitrine(_criar(auth))


def test_evento_sem_capa_fica_fora_da_vitrine_mas_o_link_funciona():
    auth, _ = _organizador()
    ev = _criar(auth, capa=None)
    assert not _na_vitrine(ev)
    assert _link_funciona(ev)


def test_organizador_com_email_nao_confirmado_fica_fora():
    auth, uid = _organizador()
    ev = _criar(auth)
    with _db() as db:
        db.get(Usuario, uid).email_verificado = False
        db.commit()
    assert not _na_vitrine(ev)


def test_organizador_desativado_some_da_vitrine():
    auth, uid = _organizador()
    ev = _criar(auth)
    with _db() as db:
        db.get(Usuario, uid).ativo = False
        db.commit()
    assert not _na_vitrine(ev)


def test_com_pagamentos_ativos_exige_conta_de_recebimento_aprovada():
    auth, uid = _organizador()
    ev = _criar(auth)
    with patch.multiple(
        settings, ASAAS_DISABLED=False, PAYMENT_PROVIDER="asaas", ASAAS_API_KEY="k", ASAAS_ONBOARDING_MODE="linked"
    ):
        assert settings.use_asaas and not settings.payments_disabled
        assert not _na_vitrine(ev)
        with _db() as db:
            db.get(Usuario, uid).asaas_repasse_status = "linked"
            db.commit()
        assert _na_vitrine(ev)


def test_cidade_so_aparece_no_filtro_com_evento_na_vitrine():
    auth, _ = _organizador()
    cidade = f"Cidade {uuid.uuid4().hex[:6]}"
    r = test_api.client.post(
        "/api/eventos/criar",
        headers=auth,
        json={
            "nome": f"Show {uuid.uuid4().hex[:6]}",
            "descricao": "Show ao vivo",
            "data_inicio": "2027-05-01T20:00:00",
            "data_fim": "2027-05-01T23:00:00",
            "local": cidade,
            "cidade": cidade,
            "preco_ingresso": 0,
            "categoria": "Outros",
            "contato_telefone": "41999990000",
            "contato_email": "c@show.com",
            "publicado": True,
            "ingresso_lotes": [{"nome": "Geral", "preco": 0, "ordem": 1, "ativo": True, "tipo": "cortesia"}],
        },
    )
    assert r.status_code == 200, r.text
    cidades = [c["cidade"] for c in TestClient(app).get("/api/eventos/cidades").json()]
    assert cidade not in cidades
