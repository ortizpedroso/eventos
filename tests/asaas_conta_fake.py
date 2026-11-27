"""Conta Asaas falsa cuja chave de API comprova a posse de uma carteira."""

from __future__ import annotations

from unittest.mock import MagicMock, patch

API_KEY_FAKE = "org_api_key_test"


def conta_asaas_dona_da_carteira(wallet_id: str):
    cliente = MagicMock()
    cliente.enabled = True
    cliente.get.return_value = {"walletId": wallet_id}
    return patch("app.services.organizador_asaas.AsaasClient", return_value=cliente)
