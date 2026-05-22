"""Login social Google / Apple."""

from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient

from app.main import app
from config.settings import settings

client = TestClient(app)


@pytest.fixture
def oauth_env(monkeypatch):
    monkeypatch.setattr(settings, "GOOGLE_OAUTH_CLIENT_ID", "google-test-client.apps.googleusercontent.com")
    monkeypatch.setattr(settings, "APPLE_OAUTH_CLIENT_ID", "com.eventosbr.web")


def test_google_login_cria_usuario(oauth_env):
    claims = {
        "sub": "google-sub-123",
        "email": "oauth.google@exemplo.com",
        "email_verified": True,
        "name": "Usuário Google",
    }
    with patch("app.routes.auth.verify_google_id_token", return_value=claims):
        r = client.post(
            "/api/auth/google",
            json={"id_token": "fake-google-jwt-token-for-tests-only", "tipo": "cliente"},
        )
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["token_type"] == "bearer"
    assert data["usuario"]["email"] == "oauth.google@exemplo.com"


def test_google_login_idempotente(oauth_env):
    claims = {
        "sub": "google-sub-456",
        "email": "oauth2.google@exemplo.com",
        "email_verified": True,
        "name": "Dup Google",
    }
    with patch("app.routes.auth.verify_google_id_token", return_value=claims):
        r1 = client.post(
            "/api/auth/google",
            json={"id_token": "fake-google-token-first-login-xx", "tipo": "cliente"},
        )
        r2 = client.post(
            "/api/auth/google",
            json={"id_token": "fake-google-token-second-login-xx", "tipo": "cliente"},
        )
    assert r1.status_code == 200
    assert r2.status_code == 200
    assert r1.json()["usuario"]["id"] == r2.json()["usuario"]["id"]


def test_apple_login_cria_usuario(oauth_env):
    claims = {
        "sub": "apple-sub-789",
        "email": "oauth.apple@exemplo.com",
        "email_verified": True,
    }
    with patch("app.routes.auth.verify_apple_id_token", return_value=claims):
        r = client.post(
            "/api/auth/apple",
            json={"id_token": "fake-apple-jwt-token-for-tests-only", "tipo": "cliente"},
        )
    assert r.status_code == 200, r.text
    assert r.json()["usuario"]["email"] == "oauth.apple@exemplo.com"


def test_oauth_desabilitado_sem_client_id(monkeypatch):
    monkeypatch.setattr(settings, "GOOGLE_OAUTH_CLIENT_ID", "")
    r = client.post(
        "/api/auth/google",
        json={"id_token": "disabled-google-token-test-xx", "tipo": "cliente"},
    )
    assert r.status_code == 503
