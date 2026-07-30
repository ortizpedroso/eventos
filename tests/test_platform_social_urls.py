"""Normalização Instagram/WhatsApp nas configs da plataforma (rodapé)."""

from __future__ import annotations

import pytest

from app.schemas.platform_settings import PlatformSettingsUpdate
from app.utils.url_publica import normalizar_url_instagram, normalizar_url_whatsapp
from config.settings import settings
from tests import test_api


@pytest.fixture
def admin_headers(monkeypatch):
    monkeypatch.setattr(settings, "PLATFORM_ADMIN_API_KEY", "chave-admin-social")
    return {"X-Platform-Admin-Key": "chave-admin-social"}


def test_normalizar_instagram_handle():
    assert normalizar_url_instagram("@eventosbr") == "https://instagram.com/eventosbr"
    assert normalizar_url_instagram("eventosbr") == "https://instagram.com/eventosbr"
    assert normalizar_url_instagram("instagram.com/eventosbr") == "https://instagram.com/eventosbr"
    assert normalizar_url_instagram("https://instagram.com/eventosbr") == "https://instagram.com/eventosbr"


def test_normalizar_whatsapp_numero():
    assert normalizar_url_whatsapp("11999998888") == "https://wa.me/5511999998888"
    assert normalizar_url_whatsapp("(11) 99999-8888") == "https://wa.me/5511999998888"
    assert normalizar_url_whatsapp("5511999998888") == "https://wa.me/5511999998888"
    assert normalizar_url_whatsapp("https://wa.me/5511999998888") == "https://wa.me/5511999998888"


def test_schema_aceita_numero_e_handle():
    body = PlatformSettingsUpdate(
        social_instagram_url="@minhamarca",
        social_whatsapp_url="11987654321",
    )
    assert body.social_instagram_url == "https://instagram.com/minhamarca"
    assert body.social_whatsapp_url == "https://wa.me/5511987654321"


def test_admin_salva_instagram_e_whatsapp_no_rodape(admin_headers):
    r = test_api.client.patch(
        "/api/admin/settings",
        headers=admin_headers,
        json={
            "social_instagram_url": "@eventosbr_oficial",
            "social_whatsapp_url": "(11) 98888-7777",
        },
    )
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["social_instagram_url"] == "https://instagram.com/eventosbr_oficial"
    assert data["social_whatsapp_url"] == "https://wa.me/5511988887777"

    pub = test_api.client.get("/api/public/platform")
    assert pub.status_code == 200
    assert "no-store" in (pub.headers.get("cache-control") or "").lower()
    p = pub.json()
    assert p["social_instagram_url"] == "https://instagram.com/eventosbr_oficial"
    assert p["social_whatsapp_url"] == "https://wa.me/5511988887777"


def test_produtor_aceita_whatsapp_numero():
    reg = test_api.client.post(
        "/api/auth/registrar",
        json={
            "email": "org.social@test.com",
            "nome": "Org Social",
            "senha": "senha12345",
            "tipo": "organizador",
        },
    )
    assert reg.status_code == 200, reg.text
    token = reg.json()["access_token"]
    patch = test_api.client.patch(
        "/api/produtor/meu-perfil",
        headers={"Authorization": f"Bearer {token}"},
        json={"social_instagram": "@produtorx", "social_whatsapp": "21988776655"},
    )
    assert patch.status_code == 200, patch.text
    me = test_api.client.get(
        "/api/produtor/meu-perfil",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert me.status_code == 200
    assert me.json()["social_instagram"] == "https://instagram.com/produtorx"
    assert me.json()["social_whatsapp"] == "https://wa.me/5521988776655"
