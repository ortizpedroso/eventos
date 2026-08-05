"""Boot da API deve falhar (fail fast) se CORS_ORIGINS estiver mal configurado em produção.

Antes desta correção, `app/main.py` apenas logava um warning quando
`CORS_ORIGINS` estava vazio ou "*" em produção, mas deixava a API subir
normalmente aceitando qualquer origem. Agora o `lifespan` reutiliza
`_cors_https_ok` (app/services/production_checks.py) e levanta
`RuntimeError` antes do `yield`, o que impede o FastAPI/Uvicorn de
terminar o startup — a API nunca chega a aceitar tráfego.
"""

import pytest
from fastapi.testclient import TestClient

from app.main import _validate_production_cors, app
from config.settings import settings


def _patch_env(monkeypatch, environment, cors_origins):
    monkeypatch.setattr(settings, "ENVIRONMENT", environment)
    monkeypatch.setattr(settings, "CORS_ORIGINS", cors_origins)


@pytest.mark.parametrize("cors_origins", ["", "*", "http://eventosbr.app.br"])
def test_validate_production_cors_levanta_erro_com_cors_invalido(monkeypatch, cors_origins):
    """Unidade: chama a validação diretamente, sem subir workers/DB do lifespan completo."""
    _patch_env(monkeypatch, "production", cors_origins)
    with pytest.raises(RuntimeError):
        _validate_production_cors()


def test_validate_production_cors_ok_com_https_explicito(monkeypatch):
    _patch_env(monkeypatch, "production", "https://eventosbr.app.br")
    _validate_production_cors()  # não deve levantar


def test_validate_production_cors_nao_bloqueia_fora_de_producao(monkeypatch):
    _patch_env(monkeypatch, "test", "")
    _validate_production_cors()  # não deve levantar (não é produção)


def test_boot_falha_com_cors_vazio_em_producao_integrado(monkeypatch):
    """Integração: subir a app via TestClient (executa o lifespan) deve falhar o startup."""
    _patch_env(monkeypatch, "production", "")
    with pytest.raises(RuntimeError):
        with TestClient(app):
            pass


def test_boot_sobe_com_cors_https_valido_em_producao_integrado(monkeypatch):
    """Integração: com CORS_ORIGINS HTTPS explícito, a app sobe normalmente."""
    _patch_env(monkeypatch, "production", "https://eventosbr.app.br")
    with TestClient(app) as client:
        r = client.get("/health")
    assert r.status_code == 200
