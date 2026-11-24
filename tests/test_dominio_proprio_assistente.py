"""Organizador cadastra o próprio domínio e o ativa sozinho quando o DNS aponta para a plataforma."""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone

import pytest

from app.models import Usuario
from app.services import dominio_proprio
from config.settings import settings
from tests import test_api
from tests.test_api import TestingSessionLocal

BASE = "eventosbr.app.br"
IP_PLATAFORMA = "187.77.240.125"


@pytest.fixture(autouse=True)
def _dns(monkeypatch):
    monkeypatch.setattr(settings, "PLATFORM_BASE_DOMAIN", BASE)
    tabela: dict[str, frozenset[str]] = {BASE: frozenset({IP_PLATAFORMA})}
    monkeypatch.setattr(dominio_proprio, "enderecos_ip", lambda host: tabela.get(host, frozenset()))
    return tabela


def _organizador(cortesia: bool = True) -> tuple[dict[str, str], str]:
    sufixo = uuid.uuid4().hex[:8]
    reg = test_api.client.post(
        "/api/auth/registrar",
        json={"email": f"dom-{sufixo}@test.com", "nome": "Agência", "senha": "senha12345", "tipo": "organizador"},
    )
    assert reg.status_code == 200, reg.text
    auth = {"Authorization": f"Bearer {reg.json()['access_token']}"}
    perfil = test_api.client.get("/api/produtor/meu-perfil", headers=auth).json()
    if cortesia:
        db = TestingSessionLocal()
        try:
            org = db.query(Usuario).filter(Usuario.slug_publico == perfil["slug_publico"]).one()
            org.whitelabel_cortesia_ate = datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(days=30)
            db.commit()
        finally:
            db.close()
    return auth, perfil["slug_publico"]


def _definir(auth, dominio):
    return test_api.client.put("/api/produtor/meu-perfil/dominio-proprio", headers=auth, json={"dominio": dominio})


def _verificar(auth):
    return test_api.client.post("/api/produtor/meu-perfil/dominio-proprio/verificar", headers=auth)


def _tenant(host: str) -> int:
    return test_api.client.get("/api/public/tenant", params={"host": host}).status_code


def test_dominio_so_ativa_quando_o_dns_aponta_para_a_plataforma(_dns):
    auth, _ = _organizador()
    dominio = f"eventos.agencia-{uuid.uuid4().hex[:6]}.com.br"

    r = _definir(auth, dominio)
    assert r.status_code == 200, r.text
    assert r.json()["dominio_proprio_cadastrado"] == dominio
    assert r.json()["dominio_proprio"] is None
    assert _tenant(dominio) == 404

    pendente = _verificar(auth).json()
    assert pendente["apontamento"]["correto"] is False
    assert pendente["dominio_proprio"] is None

    _dns[dominio] = frozenset({IP_PLATAFORMA})
    ok = _verificar(auth).json()
    assert ok["apontamento"]["correto"] is True
    assert ok["dominio_proprio"] == dominio
    assert _tenant(dominio) == 200


def test_dns_apontando_para_outro_servidor_nao_ativa(_dns):
    auth, _ = _organizador()
    dominio = f"eventos.outra-{uuid.uuid4().hex[:6]}.com.br"
    _definir(auth, dominio)
    _dns[dominio] = frozenset({IP_PLATAFORMA, "203.0.113.9"})

    r = _verificar(auth).json()

    assert r["apontamento"]["correto"] is False
    assert r["apontamento"]["ips_encontrados"] == ["187.77.240.125", "203.0.113.9"]
    assert r["dominio_proprio"] is None


def test_dominio_ja_ativo_nao_cai_se_o_dns_sair_do_ar(_dns):
    auth, _ = _organizador()
    dominio = f"eventos.ativa-{uuid.uuid4().hex[:6]}.com.br"
    _definir(auth, dominio)
    _dns[dominio] = frozenset({IP_PLATAFORMA})
    _verificar(auth)
    del _dns[dominio]

    r = _verificar(auth).json()

    assert r["apontamento"]["correto"] is False
    assert r["dominio_proprio"] == dominio


def test_trocar_de_dominio_exige_nova_verificacao(_dns):
    auth, _ = _organizador()
    antigo = f"eventos.a-{uuid.uuid4().hex[:6]}.com.br"
    novo = f"eventos.b-{uuid.uuid4().hex[:6]}.com.br"
    _definir(auth, antigo)
    _dns[antigo] = frozenset({IP_PLATAFORMA})
    _verificar(auth)

    r = _definir(auth, novo).json()

    assert r["dominio_proprio"] is None
    assert _tenant(antigo) == 404


def test_dominio_de_outro_organizador_e_recusado(_dns):
    dominio = f"eventos.disputa-{uuid.uuid4().hex[:6]}.com.br"
    auth1, _ = _organizador()
    auth2, _ = _organizador()
    assert _definir(auth1, dominio).status_code == 200

    r = _definir(auth2, dominio)

    assert r.status_code == 409


def test_sem_plano_nem_cortesia_nao_cadastra_dominio(_dns):
    auth, _ = _organizador(cortesia=False)

    r = _definir(auth, f"eventos.gratis-{uuid.uuid4().hex[:6]}.com.br")

    assert r.status_code == 409
    assert "mensalidade" in r.json()["detail"]


def test_subdominio_da_plataforma_nao_vale_como_dominio_proprio(_dns):
    auth, _ = _organizador()
    assert _definir(auth, f"agencia.{BASE}").status_code == 422
