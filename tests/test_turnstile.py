"""Verificação do Cloudflare Turnstile — desligado por padrão (opt-in)."""

import asyncio
from unittest.mock import AsyncMock, patch

from app.services import turnstile
from config.settings import settings


def test_turnstile_desligado_nao_bloqueia(monkeypatch):
    monkeypatch.setattr(settings, "TURNSTILE_SECRET_KEY", "")
    assert turnstile.turnstile_habilitado() is False
    assert asyncio.run(turnstile.verificar_turnstile(None)) is True
    assert asyncio.run(turnstile.verificar_turnstile("qualquer-coisa")) is True


def test_turnstile_ligado_sem_token_falha(monkeypatch):
    monkeypatch.setattr(settings, "TURNSTILE_SECRET_KEY", "chave-de-teste")
    assert turnstile.turnstile_habilitado() is True
    assert asyncio.run(turnstile.verificar_turnstile(None)) is False
    assert asyncio.run(turnstile.verificar_turnstile("")) is False


def test_turnstile_ligado_valida_com_cloudflare(monkeypatch):
    monkeypatch.setattr(settings, "TURNSTILE_SECRET_KEY", "chave-de-teste")

    class FakeResponse:
        is_success = True

        def json(self):
            return {"success": True}

    with patch("httpx.AsyncClient.post", new=AsyncMock(return_value=FakeResponse())):
        assert asyncio.run(turnstile.verificar_turnstile("token-valido")) is True


def test_turnstile_ligado_rejeita_token_invalido(monkeypatch):
    monkeypatch.setattr(settings, "TURNSTILE_SECRET_KEY", "chave-de-teste")

    class FakeResponse:
        is_success = True

        def json(self):
            return {"success": False, "error-codes": ["invalid-input-response"]}

    with patch("httpx.AsyncClient.post", new=AsyncMock(return_value=FakeResponse())):
        assert asyncio.run(turnstile.verificar_turnstile("token-invalido")) is False


def test_turnstile_usa_turnstile_secret_env(monkeypatch):
    monkeypatch.setattr(settings, "TURNSTILE_SECRET", "secret-spin")
    monkeypatch.setattr(settings, "TURNSTILE_SECRET_KEY", "")
    assert turnstile.turnstile_secret() == "secret-spin"
    assert turnstile.turnstile_habilitado() is True


def test_turnstile_fallback_secret_key_legado(monkeypatch):
    monkeypatch.setattr(settings, "TURNSTILE_SECRET", "")
    monkeypatch.setattr(settings, "TURNSTILE_SECRET_KEY", "legado-key")
    assert turnstile.turnstile_secret() == "legado-key"


def test_turnstile_falha_em_http_error(monkeypatch):
    monkeypatch.setattr(settings, "TURNSTILE_SECRET_KEY", "chave-de-teste")

    class FakeResponse:
        is_success = False
        status_code = 503

        def json(self):
            return {}

    with patch("httpx.AsyncClient.post", new=AsyncMock(return_value=FakeResponse())):
        assert asyncio.run(turnstile.verificar_turnstile("token")) is False
