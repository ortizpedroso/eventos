"""Cadastro de organizador com confirmação de e-mail (24h)."""

import pytest

from app.services.email_verificacao import confirmar_email_por_token
from tests import test_api
from tests.helpers import login_organizador_verificado


@pytest.mark.organizador_email_flow
def test_registrar_organizador_pendente_sem_token(monkeypatch):
    monkeypatch.setattr(
        "app.services.email_verificacao.enviar_email_boas_vindas_organizador",
        lambda **kw: True,
    )
    client = test_api.client
    email = "org.pendente@test.com"
    r = client.post(
        "/api/auth/registrar",
        json={
            "email": email,
            "nome": "Org Pendente",
            "senha": "senha-forte-123",
            "tipo": "organizador",
        },
    )
    assert r.status_code == 200, r.text
    data = r.json()
    assert data.get("pending_email_verification") is True
    assert data.get("email") == email
    assert data.get("access_token") is None
    assert "confirmação" in (data.get("message") or "").lower()

    login = client.post(
        "/api/auth/login",
        json={"email": email, "senha": "senha-forte-123"},
    )
    assert login.status_code == 403


@pytest.mark.organizador_email_flow
def test_confirmar_email_organizador_e_login(monkeypatch):
    monkeypatch.setattr(
        "app.services.email_verificacao.enviar_email_boas_vindas_organizador",
        lambda **kw: True,
    )
    client = test_api.client
    email = "org.confirm@test.com"
    r = client.post(
        "/api/auth/registrar",
        json={
            "email": email,
            "nome": "Org Confirm",
            "senha": "senha-forte-123",
            "tipo": "organizador",
        },
    )
    assert r.status_code == 200
    db = test_api.TestingSessionLocal()
    from app.models import Usuario

    u = db.query(Usuario).filter(Usuario.email == email).first()
    assert u and u.email_verificacao_token
    token = u.email_verificacao_token
    db.close()

    ok = client.post("/api/auth/verificar-email", json={"token": token})
    assert ok.status_code == 200, ok.text
    assert ok.json().get("access_token")

    token_login = login_organizador_verificado(client, email)
    assert token_login


@pytest.mark.organizador_email_flow
def test_confirmar_por_token_direto(monkeypatch):
    monkeypatch.setattr(
        "app.services.email_verificacao.enviar_email_boas_vindas_organizador",
        lambda **kw: True,
    )
    client = test_api.client
    email = "org.token@test.com"
    client.post(
        "/api/auth/registrar",
        json={
            "email": email,
            "nome": "Org Token",
            "senha": "senha-forte-123",
            "tipo": "organizador",
        },
    )
    db = test_api.TestingSessionLocal()
    from app.models import Usuario

    u = db.query(Usuario).filter(Usuario.email == email).first()
    token = u.email_verificacao_token
    confirmar_email_por_token(db, token)
    db.close()
    login_organizador_verificado(client, email)


def test_imagem_url_rejeita_externo(monkeypatch):
    from config.settings import settings
    from app.utils.imagem_url import validar_imagem_url

    monkeypatch.setattr(settings, "FRONTEND_PUBLIC_URL", "https://eventosbr.app.br")
    monkeypatch.setattr(settings, "R2_PUBLIC_URL", "https://pub-test.r2.dev")

    try:
        validar_imagem_url("https://evil.example.com/banner.jpg")
        assert False, "deveria rejeitar URL externa"
    except ValueError as e:
        assert "externa" in str(e).lower() or "permitida" in str(e).lower()
