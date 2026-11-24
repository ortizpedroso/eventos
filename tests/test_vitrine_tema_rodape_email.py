"""Tema e rodapé da vitrine, e e-mail do ingresso com a marca do organizador."""

from __future__ import annotations

import uuid
from types import SimpleNamespace

import pytest

from app.services.email_branding import EmailBranding, branding_do_organizador, build_email_html
from config.settings import settings
from tests import test_api

BASE = "eventosbr.app.br"
PLATAFORMA = EmailBranding(
    site_name="EventosBR",
    primary_color="#10b981",
    primary_color_dark="#047857",
    logo_url="https://eventosbr.app.br/logo.png",
    footer_domain="eventosbr.app.br",
)


@pytest.fixture(autouse=True)
def _base_domain(monkeypatch):
    monkeypatch.setattr(settings, "PLATFORM_BASE_DOMAIN", BASE)
    monkeypatch.setattr(settings, "FRONTEND_PUBLIC_URL", "https://eventosbr.app.br")


def _organizador() -> dict[str, str]:
    reg = test_api.client.post(
        "/api/auth/registrar",
        json={
            "email": f"tema-{uuid.uuid4().hex[:8]}@test.com",
            "nome": "Agência",
            "senha": "senha12345",
            "tipo": "organizador",
        },
    )
    assert reg.status_code == 200, reg.text
    return {"Authorization": f"Bearer {reg.json()['access_token']}"}


def test_tema_e_rodape_chegam_na_vitrine_e_podem_ser_limpos():
    auth = _organizador()
    sub = f"tema-{uuid.uuid4().hex[:8]}"
    r = test_api.client.patch(
        "/api/produtor/meu-perfil",
        headers=auth,
        json={"brand_subdomain": sub, "brand_tema_vitrine": "escuro", "brand_rodape_texto": "  CNPJ 00.000.000/0001-00 "},
    )
    assert r.status_code == 200, r.text

    tenant = test_api.client.get("/api/public/tenant", params={"host": f"{sub}.{BASE}"}).json()
    assert tenant["brand_tema_vitrine"] == "escuro"
    assert tenant["brand_rodape_texto"] == "CNPJ 00.000.000/0001-00"

    test_api.client.patch(
        "/api/produtor/meu-perfil", headers=auth, json={"brand_tema_vitrine": None, "brand_rodape_texto": ""}
    )
    tenant = test_api.client.get("/api/public/tenant", params={"host": f"{sub}.{BASE}"}).json()
    assert tenant["brand_tema_vitrine"] is None
    assert tenant["brand_rodape_texto"] is None


def test_tema_invalido_e_recusado():
    r = test_api.client.patch("/api/produtor/meu-perfil", headers=_organizador(), json={"brand_tema_vitrine": "roxo"})
    assert r.status_code == 422


def _org(**campos):
    base = dict(
        nome="Cristiano",
        brand_name=None,
        brand_logo_url=None,
        foto_url=None,
        brand_primary_color=None,
        brand_primary_color_dark=None,
    )
    return SimpleNamespace(**{**base, **campos})


def test_email_do_ingresso_leva_a_marca_do_organizador_e_a_plataforma_no_rodape():
    org = _org(
        brand_name="Agência do Vale",
        brand_logo_url="/uploads/org/x/logo.webp",
        brand_primary_color="#e06e1e",
        brand_primary_color_dark="#9a4410",
    )
    branding, rodape = branding_do_organizador(PLATAFORMA, org)
    html = build_email_html(title="Noite do Flashback", body_html="<p>ok</p>", branding=branding, footer_note=rodape)

    assert 'src="https://eventosbr.app.br/uploads/org/x/logo.webp"' in html
    assert 'alt="Agência do Vale"' in html
    assert "#9a4410" in html
    assert "https://eventosbr.app.br/logo.png" not in html
    assert "Ingresso emitido pela plataforma EventosBR" in html


def test_organizador_sem_logo_usa_a_foto_e_sem_cor_mantem_a_da_plataforma():
    branding, _ = branding_do_organizador(PLATAFORMA, _org(foto_url="https://eventosbr.app.br/uploads/foto.webp"))

    assert branding.site_name == "Cristiano"
    assert branding.logo_url == "https://eventosbr.app.br/uploads/foto.webp"
    assert branding.primary_color_dark == "#047857"


def test_sem_organizador_o_email_fica_com_a_marca_da_plataforma():
    branding, rodape = branding_do_organizador(PLATAFORMA, None)

    assert branding is PLATAFORMA
    assert "EventosBR" in rodape
