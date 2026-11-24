"""Capa e favicon que o organizador escolhe para a página pública e a vitrine."""

from __future__ import annotations

import uuid

import pytest

from config.settings import settings
from tests import test_api

BASE = "eventosbr.app.br"
CAPA = "/uploads/organizador/capa.webp"
FAVICON = "/uploads/organizador/favicon.png"
FOTO = "/uploads/organizador/foto.webp"


@pytest.fixture(autouse=True)
def _base_domain(monkeypatch):
    monkeypatch.setattr(settings, "PLATFORM_BASE_DOMAIN", BASE)


def _organizador() -> dict[str, str]:
    sufixo = uuid.uuid4().hex[:8]
    reg = test_api.client.post(
        "/api/auth/registrar",
        json={"email": f"capa-{sufixo}@test.com", "nome": "Agência", "senha": "senha12345", "tipo": "organizador"},
    )
    assert reg.status_code == 200, reg.text
    return {"Authorization": f"Bearer {reg.json()['access_token']}"}


def _patch(auth: dict[str, str], **campos) -> dict:
    r = test_api.client.patch("/api/produtor/meu-perfil", headers=auth, json=campos)
    assert r.status_code == 200, r.text
    return r.json()


def test_capa_aparece_na_pagina_publica_e_pode_ser_removida():
    auth = _organizador()
    slug = _patch(auth, brand_cover_url=CAPA)["slug_publico"]

    assert test_api.client.get(f"/api/produtor/{slug}").json()["brand_cover_url"] == CAPA

    _patch(auth, brand_cover_url=None)
    assert test_api.client.get(f"/api/produtor/{slug}").json()["brand_cover_url"] is None


def test_salvar_outros_campos_nao_apaga_capa_nem_favicon():
    auth = _organizador()
    _patch(auth, brand_cover_url=CAPA, brand_favicon_url=FAVICON)

    perfil = _patch(auth, bio="Nova bio")

    assert perfil["brand_cover_url"] == CAPA
    assert perfil["brand_favicon_url"] == FAVICON


def test_capa_rejeita_url_externa():
    auth = _organizador()
    r = test_api.client.patch(
        "/api/produtor/meu-perfil", headers=auth, json={"brand_cover_url": "https://site-qualquer.com/capa.png"}
    )
    assert r.status_code == 422


def test_vitrine_usa_favicon_do_organizador_e_cai_na_foto_sem_ele():
    auth = _organizador()
    sub = f"agencia-{uuid.uuid4().hex[:8]}"
    _patch(auth, brand_subdomain=sub, foto_url=FOTO)

    def favicon() -> str | None:
        r = test_api.client.get("/api/public/tenant", params={"host": f"{sub}.{BASE}"})
        assert r.status_code == 200, r.text
        return r.json()["brand_favicon_url"]

    assert favicon() == FOTO
    _patch(auth, brand_favicon_url=FAVICON)
    assert favicon() == FAVICON
