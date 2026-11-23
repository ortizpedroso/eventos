"""Login com captcha ligado: o formulário precisa enviar o token (inclusive o do painel de compra)."""

from __future__ import annotations

import uuid
from unittest.mock import AsyncMock, patch

import pytest

from tests.test_api import client

SENHA = "senha-forte-123"


@pytest.fixture
def cliente_cadastrado() -> str:
    email = f"cliente-{uuid.uuid4().hex[:8]}@example.com"
    r = client.post(
        "/api/auth/registrar",
        json={"email": email, "nome": "Cliente Captcha", "senha": SENHA, "tipo": "cliente"},
    )
    assert r.status_code == 200, r.text
    return email


@pytest.fixture
def captcha_ligado(monkeypatch):
    monkeypatch.setenv("TURNSTILE_SECRET", "segredo-de-teste")


def test_login_sem_token_e_recusado_com_captcha_ligado(cliente_cadastrado, captcha_ligado):
    r = client.post("/api/auth/login", json={"email": cliente_cadastrado, "senha": SENHA})

    assert r.status_code == 400
    assert "robô" in r.json()["detail"]


def test_login_com_token_valido_entra_com_captcha_ligado(cliente_cadastrado, captcha_ligado):
    with patch("app.services.turnstile.httpx.AsyncClient") as cliente_http:
        resposta = cliente_http.return_value.__aenter__.return_value
        resposta.post = AsyncMock(
            return_value=type("R", (), {"is_success": True, "json": lambda self: {"success": True}})()
        )
        r = client.post(
            "/api/auth/login",
            json={"email": cliente_cadastrado, "senha": SENHA, "turnstile_token": "token-do-widget"},
        )

    assert r.status_code == 200, r.text
    enviado = resposta.post.call_args.kwargs["data"]
    assert enviado["response"] == "token-do-widget"
