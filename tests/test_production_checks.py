"""Checklist de configuração de produção."""

from config.settings import settings

from app.services.production_checks import build_setup_status


def test_build_setup_status_em_teste():
    prev = settings.ENVIRONMENT
    settings.ENVIRONMENT = "test"
    try:
        s = build_setup_status()
        assert s["environment"] == "test"
        assert "checks" in s
        assert "asaas_api" in s["checks"]
        assert s["payment_provider"] == "asaas"
    finally:
        settings.ENVIRONMENT = prev


def test_build_setup_status_asaas_producao():
    prev_env = settings.ENVIRONMENT
    prev_key = settings.ASAAS_API_KEY
    prev_wh = settings.ASAAS_WEBHOOK_TOKEN
    prev_wallet = settings.ASAAS_PLATFORM_WALLET_ID
    prev_disabled = settings.ASAAS_DISABLED
    try:
        settings.ENVIRONMENT = "production"
        settings.ASAAS_DISABLED = False
        settings.ASAAS_API_KEY = "$aact_prod_test_key_with_enough_length"
        settings.ASAAS_WEBHOOK_TOKEN = "webhook_token_forte"
        settings.ASAAS_PLATFORM_WALLET_ID = "wallet-plataforma-id"
        s = build_setup_status()
        assert s["checks"]["asaas_api"] == "ok"
        assert s["checks"]["asaas_webhook"] == "ok"
        assert s["checks"]["asaas_platform_wallet"] == "ok"
    finally:
        settings.ENVIRONMENT = prev_env
        settings.ASAAS_API_KEY = prev_key
        settings.ASAAS_WEBHOOK_TOKEN = prev_wh
        settings.ASAAS_PLATFORM_WALLET_ID = prev_wallet
        settings.ASAAS_DISABLED = prev_disabled
