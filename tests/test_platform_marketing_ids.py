"""Meta Pixel e GTM configuráveis no admin (platform_settings)."""

from __future__ import annotations

import pytest

from app.schemas.platform_settings import PlatformSettingsUpdate
from app.utils.url_publica import normalizar_gtm_id, normalizar_meta_pixel_id
from config.settings import settings
from tests import test_api


@pytest.fixture
def admin_headers(monkeypatch):
    monkeypatch.setattr(settings, "PLATFORM_ADMIN_API_KEY", "chave-admin-marketing")
    return {"X-Platform-Admin-Key": "chave-admin-marketing"}


def test_normalizar_meta_pixel_id():
    assert normalizar_meta_pixel_id("123456789012345") == "123456789012345"
    assert normalizar_meta_pixel_id(" 12345 ") == "12345"
    assert normalizar_meta_pixel_id("") is None
    assert normalizar_meta_pixel_id(None) is None


def test_normalizar_meta_pixel_id_invalido():
    with pytest.raises(ValueError, match="inválido"):
        normalizar_meta_pixel_id("abc")


def test_normalizar_gtm_id():
    assert normalizar_gtm_id("gtm-abc123") == "GTM-ABC123"
    assert normalizar_gtm_id("GTM-XXXXXX") == "GTM-XXXXXX"
    assert normalizar_gtm_id("") is None


def test_normalizar_gtm_id_invalido():
    with pytest.raises(ValueError, match="inválido"):
        normalizar_gtm_id("UA-12345")


def test_schema_aceita_pixel_e_gtm():
    body = PlatformSettingsUpdate(meta_pixel_id="9876543210", gtm_id="gtm-test1")
    assert body.meta_pixel_id == "9876543210"
    assert body.gtm_id == "GTM-TEST1"


def test_admin_salva_pixel_e_gtm_publico(admin_headers, monkeypatch):
    monkeypatch.delenv("NEXT_PUBLIC_META_PIXEL_ID", raising=False)
    monkeypatch.delenv("NEXT_PUBLIC_GTM_ID", raising=False)

    r = test_api.client.patch(
        "/api/admin/settings",
        headers=admin_headers,
        json={"meta_pixel_id": "11122233344", "gtm_id": "GTM-PIXEL01"},
    )
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["meta_pixel_id"] == "11122233344"
    assert data["gtm_id"] == "GTM-PIXEL01"

    pub = test_api.client.get("/api/public/platform")
    assert pub.status_code == 200
    p = pub.json()
    assert p["meta_pixel_id"] == "11122233344"
    assert p["gtm_id"] == "GTM-PIXEL01"


def test_public_fallback_env_quando_db_vazio(admin_headers, monkeypatch):
    monkeypatch.setenv("NEXT_PUBLIC_META_PIXEL_ID", "55566677788")
    monkeypatch.setenv("NEXT_PUBLIC_GTM_ID", "GTM-ENVFALL")

    r = test_api.client.patch(
        "/api/admin/settings",
        headers=admin_headers,
        json={"meta_pixel_id": None, "gtm_id": None},
    )
    assert r.status_code == 200, r.text

    pub = test_api.client.get("/api/public/platform")
    assert pub.status_code == 200
    p = pub.json()
    assert p["meta_pixel_id"] == "55566677788"
    assert p["gtm_id"] == "GTM-ENVFALL"
