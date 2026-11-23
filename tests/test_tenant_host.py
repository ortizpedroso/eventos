"""White-label servido no endereço do organizador: subdomínio da plataforma ou domínio próprio."""

from __future__ import annotations

import uuid
from datetime import datetime

import pytest

from app.models import Usuario
from app.services.organizador_publico import validar_dominio_proprio
from config.settings import settings
from tests.test_api import TestingSessionLocal, client

BASE = "eventosbr.app.br"


@pytest.fixture(autouse=True)
def _base_domain(monkeypatch):
    monkeypatch.setattr(settings, "PLATFORM_BASE_DOMAIN", BASE)


def _organizador(**campos) -> Usuario:
    sufixo = uuid.uuid4().hex[:8]
    db = TestingSessionLocal()
    try:
        org = Usuario(
            email=f"org-{sufixo}@example.com",
            nome="Cristiano Braga",
            senha_hash="x",
            tipo="organizador",
            ativo=True,
            slug_publico=f"cristiano-{sufixo}",
            **campos,
        )
        db.add(org)
        db.commit()
        db.refresh(org)
        db.expunge(org)
        return org
    finally:
        db.close()


def _sufixo() -> str:
    return uuid.uuid4().hex[:8]


def test_dominio_proprio_ativo_resolve_organizador():
    dominio = f"eventos.agencia-{_sufixo()}.com.br"
    org = _organizador(
        brand_name="Agência do Vale",
        brand_custom_domain=dominio,
        brand_custom_domain_ativo_em=datetime(2026, 11, 23),
    )

    r = client.get("/api/public/tenant", params={"host": f"{dominio.upper()}:443"})

    assert r.status_code == 200, r.text
    body = r.json()
    assert body["slug"] == org.slug_publico
    assert body["organizador_id"] == org.id
    assert body["nome"] == "Agência do Vale"
    assert body["host"] == dominio


def test_dominio_proprio_pendente_nao_resolve_nem_recebe_certificado():
    dominio = f"eventos.pendente-{_sufixo()}.com.br"
    _organizador(brand_custom_domain=dominio)

    assert client.get("/api/public/tenant", params={"host": dominio}).status_code == 404
    assert client.get("/api/public/tls-ask", params={"domain": dominio}).status_code == 404


def test_subdominio_da_plataforma_resolve_e_recebe_certificado():
    sub = f"cristiano{_sufixo()}"
    org = _organizador(brand_subdomain=sub)

    r = client.get("/api/public/tenant", params={"host": f"{sub}.{BASE}"})
    assert r.status_code == 200, r.text
    assert r.json()["slug"] == org.slug_publico
    assert client.get("/api/public/tls-ask", params={"domain": f"{sub}.{BASE}"}).status_code == 200


@pytest.mark.parametrize(
    "host",
    [BASE, f"www.{BASE}", "desconhecido.example.com", "a.b.c." + BASE, "localhost", "nao_valido.com"],
)
def test_enderecos_sem_organizador_nao_resolvem(host):
    assert client.get("/api/public/tenant", params={"host": host}).status_code == 404
    assert client.get("/api/public/tls-ask", params={"domain": host}).status_code == 404


def test_tenant_inexistente_responde_404_esperado_pelos_scripts_de_deploy():
    r = client.get("/api/public/tenant", params={"host": "deploy-check.invalid"})
    assert r.status_code == 404
    assert "Organizador não encontrado" in r.text


@pytest.mark.parametrize("valor", [BASE, f"loja.{BASE}", "sem-ponto", "http://x.com/a"])
def test_dominio_proprio_recusa_enderecos_da_plataforma_e_invalidos(valor):
    with pytest.raises(ValueError):
        validar_dominio_proprio(valor)


def test_dominio_proprio_normaliza():
    assert validar_dominio_proprio("  Eventos.AgenciaDoVale.com.br. ") == "eventos.agenciadovale.com.br"
