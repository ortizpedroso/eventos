"""Domínio próprio liberado por assinatura, cortesia do dono da plataforma ou tolerância de 7 dias."""

from __future__ import annotations

import uuid
from datetime import date, datetime, timedelta, timezone

import pytest

from app.models import Usuario
from app.services.whitelabel_acesso import acesso_whitelabel, fim_do_dia_brasilia
from config.settings import settings
from tests.test_api import TestingSessionLocal, client

BASE = "eventosbr.app.br"
ADMIN = {"X-Platform-Admin-Key": "chave-admin-teste"}
AGORA = datetime(2026, 11, 24, 12, 0, 0)


@pytest.fixture(autouse=True)
def _config(monkeypatch):
    monkeypatch.setattr(settings, "PLATFORM_BASE_DOMAIN", BASE)
    monkeypatch.setattr(settings, "PLATFORM_ADMIN_API_KEY", "chave-admin-teste")


def _org(**campos) -> Usuario:
    sufixo = uuid.uuid4().hex[:8]
    db = TestingSessionLocal()
    try:
        org = Usuario(
            email=f"wl-{sufixo}@example.com",
            nome="Agência Teste",
            senha_hash="x",
            tipo="organizador",
            ativo=True,
            slug_publico=f"agencia-{sufixo}",
            **campos,
        )
        db.add(org)
        db.commit()
        db.refresh(org)
        db.expunge(org)
        return org
    finally:
        db.close()


def _dominio_ativo() -> dict:
    return {
        "brand_custom_domain": f"eventos.agencia-{uuid.uuid4().hex[:8]}.com.br",
        "brand_custom_domain_ativo_em": datetime(2026, 11, 23),
    }


@pytest.mark.parametrize(
    ("campos", "motivo"),
    [
        ({}, "sem_plano"),
        ({"whitelabel_cortesia_ate": AGORA + timedelta(days=30)}, "cortesia"),
        ({"plano_tarifa": "assinatura", "assinatura_valida_ate": AGORA + timedelta(days=10)}, "assinatura"),
        ({"plano_tarifa": "padrao", "assinatura_valida_ate": AGORA - timedelta(days=3)}, "tolerancia"),
        ({"whitelabel_cortesia_ate": AGORA - timedelta(days=6)}, "tolerancia"),
        ({"whitelabel_cortesia_ate": AGORA - timedelta(days=8)}, "sem_plano"),
    ],
)
def test_regra_de_acesso_ao_dominio_proprio(campos, motivo):
    org = Usuario(tipo="organizador", plano_tarifa=campos.pop("plano_tarifa", "padrao"), **campos)
    assert acesso_whitelabel(org, AGORA).motivo == motivo


def test_vale_o_prazo_mais_longo_entre_assinatura_e_cortesia():
    org = Usuario(
        tipo="organizador",
        plano_tarifa="assinatura",
        assinatura_valida_ate=AGORA + timedelta(days=10),
        whitelabel_cortesia_ate=AGORA + timedelta(days=90),
    )
    acesso = acesso_whitelabel(org, AGORA)
    assert (acesso.motivo, acesso.ate) == ("cortesia", AGORA + timedelta(days=90))


def test_cortesia_vale_ate_23h59_de_brasilia():
    assert fim_do_dia_brasilia(date(2027, 3, 31)) == datetime(2027, 4, 1, 2, 59, 59)


def test_dominio_proprio_sem_plano_responde_bloqueado_mas_mantem_certificado():
    org = _org(**_dominio_ativo())
    host = org.brand_custom_domain

    r = client.get("/api/public/tenant", params={"host": host})
    assert r.status_code == 200, r.text
    assert r.json()["liberado"] is False
    assert client.get("/api/public/tls-ask", params={"domain": host}).status_code == 200


def test_subdominio_da_plataforma_continua_liberado_sem_plano():
    sub = f"agencia{uuid.uuid4().hex[:8]}"
    _org(brand_subdomain=sub)
    r = client.get("/api/public/tenant", params={"host": f"{sub}.{BASE}"})
    assert r.json()["liberado"] is True


def test_admin_concede_e_remove_cortesia():
    org = _org(**_dominio_ativo())
    host = org.brand_custom_domain
    fim = (datetime.now(timezone.utc) + timedelta(days=60)).date()

    r = client.patch(
        f"/api/admin/organizadores/{org.id}/whitelabel", json={"cortesia_ate": fim.isoformat()}, headers=ADMIN
    )
    assert r.status_code == 200, r.text
    assert r.json()["cortesia_ate"] == fim.isoformat()
    assert r.json()["acesso"]["motivo"] == "cortesia"
    assert client.get("/api/public/tenant", params={"host": host}).json()["liberado"] is True

    r = client.patch(f"/api/admin/organizadores/{org.id}/whitelabel", json={"cortesia_ate": None}, headers=ADMIN)
    assert r.json()["acesso"]["motivo"] == "sem_plano"
    assert client.get("/api/public/tenant", params={"host": host}).json()["liberado"] is False


def test_cortesia_exige_admin():
    org = _org()
    r = client.patch(f"/api/admin/organizadores/{org.id}/whitelabel", json={"cortesia_ate": "2027-01-31"})
    assert r.status_code in (401, 403)
