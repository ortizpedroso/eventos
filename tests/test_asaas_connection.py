"""Testes do script de conexão Asaas."""

from __future__ import annotations

import importlib.util
from pathlib import Path
from unittest.mock import MagicMock, patch

from config.settings import settings

_ROOT = Path(__file__).resolve().parents[1]
_SCRIPT = _ROOT / "scripts" / "test-asaas-connection.py"


def _load_module():
    spec = importlib.util.spec_from_file_location("test_asaas_connection", _SCRIPT)
    assert spec and spec.loader
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def test_asaas_connection_script_ok(monkeypatch):
    monkeypatch.setattr(settings, "ASAAS_DISABLED", False)
    monkeypatch.setattr(settings, "ASAAS_API_KEY", "$aact_hmlg_test_key_with_enough_chars")
    monkeypatch.setattr(settings, "ASAAS_ENVIRONMENT", "sandbox")
    monkeypatch.setattr(settings, "ASAAS_PLATFORM_WALLET_ID", "wallet-abc-123")

    mod = _load_module()
    mock_client = MagicMock()
    mock_client.request.return_value = {
        "walletId": "wallet-abc-123",
        "name": "EventosBR Test",
        "email": "test@example.com",
    }

    with patch.object(mod, "get_asaas_client", return_value=mock_client):
        assert mod.main() == 0
        mock_client.request.assert_called_once_with("GET", "/v3/myAccount")


def test_asaas_connection_wallet_mismatch(monkeypatch):
    monkeypatch.setattr(settings, "ASAAS_DISABLED", False)
    monkeypatch.setattr(settings, "ASAAS_API_KEY", "$aact_hmlg_test_key_with_enough_chars")
    monkeypatch.setattr(settings, "ASAAS_ENVIRONMENT", "sandbox")
    monkeypatch.setattr(settings, "ASAAS_PLATFORM_WALLET_ID", "wallet-env")

    mod = _load_module()
    mock_client = MagicMock()
    mock_client.request.return_value = {"walletId": "wallet-api-different"}

    with patch.object(mod, "get_asaas_client", return_value=mock_client):
        assert mod.main() == 3
