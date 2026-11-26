"""Meta Pixel e GTM próprios do organizador: só com white-label liberado e só na vitrine dele."""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone

import pytest

from app.models import Usuario
from config.settings import settings
from tests import test_api
from tests.test_api import TestingSessionLocal

BASE = "eventosbr.app.br"


@pytest.fixture(autouse=True)
def _base_domain(monkeypatch):
    monkeypatch.setattr(settings, "PLATFORM_BASE_DOMAIN", BASE)


def _organizador(cortesia: bool) -> tuple[dict[str, str], str]:
    sufixo = uuid.uuid4().hex[:8]
    reg = test_api.client.post(
        "/api/auth/registrar",
        json={"email": f"mkt-{sufixo}@test.com", "nome": "Agência", "senha": "senha12345", "tipo": "organizador"},
    )
    assert reg.status_code == 200, reg.text
    auth = {"Authorization": f"Bearer {reg.json()['access_token']}"}
    sub = f"mkt-{sufixo}"
    r = test_api.client.patch("/api/produtor/meu-perfil", headers=auth, json={"brand_subdomain": sub})
    assert r.status_code == 200, r.text
    if cortesia:
        db = TestingSessionLocal()
        try:
            org = db.query(Usuario).filter(Usuario.brand_subdomain == sub).one()
            org.whitelabel_cortesia_ate = datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(days=30)
            db.commit()
        finally:
            db.close()
    return auth, f"{sub}.{BASE}"


def _tenant(host: str) -> dict:
    r = test_api.client.get("/api/public/tenant", params={"host": host})
    assert r.status_code == 200, r.text
    return r.json()


def test_organizador_liberado_salva_e_a_vitrine_recebe_as_tags():
    auth, host = _organizador(cortesia=True)

    r = test_api.client.patch(
        "/api/produtor/meu-perfil",
        headers=auth,
        json={"marketing_meta_pixel_id": " 123456789012345 ", "marketing_gtm_id": "gtm-abc1234"},
    )

    assert r.status_code == 200, r.text
    assert r.json()["marketing_gtm_id"] == "GTM-ABC1234"
    tenant = _tenant(host)
    assert tenant["marketing_meta_pixel_id"] == "123456789012345"
    assert tenant["marketing_gtm_id"] == "GTM-ABC1234"


def test_sem_plano_nao_cadastra_tags():
    auth, host = _organizador(cortesia=False)

    r = test_api.client.patch("/api/produtor/meu-perfil", headers=auth, json={"marketing_meta_pixel_id": "123456789012345"})

    assert r.status_code == 409
    assert _tenant(host)["marketing_meta_pixel_id"] is None


def test_tags_somem_da_vitrine_quando_o_plano_acaba():
    auth, host = _organizador(cortesia=True)
    test_api.client.patch("/api/produtor/meu-perfil", headers=auth, json={"marketing_gtm_id": "GTM-ABC1234"})
    db = TestingSessionLocal()
    try:
        org = db.query(Usuario).filter(Usuario.brand_subdomain == host.split(".")[0]).one()
        org.whitelabel_cortesia_ate = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(days=30)
        db.commit()
    finally:
        db.close()

    assert _tenant(host)["marketing_gtm_id"] is None


def test_ids_invalidos_sao_recusados():
    auth, _ = _organizador(cortesia=True)
    for campo, valor in (("marketing_meta_pixel_id", "abc"), ("marketing_gtm_id", "UA-12345")):
        r = test_api.client.patch("/api/produtor/meu-perfil", headers=auth, json={campo: valor})
        assert r.status_code == 422, (campo, r.text)


def test_salvar_perfil_sem_os_campos_nao_apaga_as_tags():
    auth, host = _organizador(cortesia=True)
    test_api.client.patch("/api/produtor/meu-perfil", headers=auth, json={"marketing_gtm_id": "GTM-ABC1234"})

    test_api.client.patch("/api/produtor/meu-perfil", headers=auth, json={"bio": "Nova bio"})

    assert _tenant(host)["marketing_gtm_id"] == "GTM-ABC1234"
