"""Checklist de configuração de produção."""

from unittest.mock import patch

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


def test_cors_http_rejeitado_em_producao():
    with patch.multiple(settings, ENVIRONMENT="production", CORS_ORIGINS="http://site.com"):
        s = build_setup_status()
    assert s["checks"]["cors"] == "pendente"


def test_cors_https_ok_em_producao():
    with patch.multiple(
        settings,
        ENVIRONMENT="production",
        CORS_ORIGINS="https://eventosbr.app.br,https://www.eventosbr.app.br",
    ):
        s = build_setup_status()
    assert s["checks"]["cors"] == "ok"


def test_manual_wallet_bloqueado_em_producao():
    with patch.multiple(settings, ENVIRONMENT="production", ASAAS_ALLOW_MANUAL_WALLET=True):
        s = build_setup_status()
    assert s["checks"]["asaas_manual_wallet_off"] == "pendente"
    assert s["ready_for_production"] is False


def test_asaas_environment_exigido_em_producao():
    with patch.multiple(
        settings, ENVIRONMENT="production", ASAAS_ENVIRONMENT="sandbox", ASAAS_DISABLED=False
    ):
        s = build_setup_status()
    assert s["checks"]["asaas_environment"] == "pendente"


def test_postgres_password_via_database_url():
    with patch.multiple(
        settings,
        ENVIRONMENT="production",
        DATABASE_URL="postgresql+psycopg2://eventosbr:s3nh4forte@db:5432/eventosbr",
    ):
        s = build_setup_status()
    assert s["checks"]["postgres_password"] == "ok"


def test_postgres_sqlite_rejeitado_em_producao():
    with patch.multiple(
        settings, ENVIRONMENT="production", DATABASE_URL="sqlite:///./eventos.db"
    ):
        s = build_setup_status()
    assert s["checks"]["postgres_password"] == "pendente"


def test_frontend_url_obrigatorio_em_producao():
    with patch.multiple(
        settings,
        ENVIRONMENT="production",
        FRONTEND_PUBLIC_URL="",
        SECRET_KEY="x" * 32,
        PLATFORM_ADMIN_API_KEY="admin-key",
        EMAIL_USER="a@b.com",
        EMAIL_PASSWORD="secret",
        ASAAS_API_KEY="$aact_prod_test_key_with_enough_length",
        ASAAS_WEBHOOK_TOKEN="webhook_token_forte",
        ASAAS_PLATFORM_WALLET_ID="wallet-plataforma-id",
        ASAAS_DISABLED=False,
        CORS_ORIGINS="https://eventosbr.app.br",
        DATABASE_URL="postgresql+psycopg2://eventosbr:s3nh4forte@db:5432/eventosbr",
    ):
        s = build_setup_status()
    assert s["checks"]["frontend_url"] == "pendente"
    assert s["ready_for_production"] is False


def test_onboarding_baas_obrigatorio_em_producao():
    with patch.multiple(settings, ENVIRONMENT="production", ASAAS_ONBOARDING_MODE="linked"):
        s = build_setup_status()
    assert s["checks"]["asaas_onboarding_mode"] == "pendente"


def test_asaas_disabled_bloqueado_em_producao():
    with patch.multiple(
        settings,
        ENVIRONMENT="production",
        ASAAS_DISABLED=True,
        SECRET_KEY="x" * 32,
        PLATFORM_ADMIN_API_KEY="admin-key",
        EMAIL_USER="a@b.com",
        EMAIL_PASSWORD="secret",
        CORS_ORIGINS="https://eventosbr.app.br",
        FRONTEND_PUBLIC_URL="https://eventosbr.app.br",
        DATABASE_URL="postgresql+psycopg2://eventosbr:s3nh4forte@db:5432/eventosbr",
    ):
        s = build_setup_status()
    assert s["checks"]["asaas_payments_enabled"] == "pendente"
    assert s["ready_for_production"] is False


def test_onboarding_mode_fallback_baas():
    with patch.multiple(settings, ASAAS_ONBOARDING_MODE="invalido"):
        assert settings.asaas_onboarding_mode == "baas"
    with patch.multiple(settings, ASAAS_ONBOARDING_MODE=""):
        assert settings.asaas_onboarding_mode == "baas"
    with patch.multiple(settings, ASAAS_ONBOARDING_MODE="linked"):
        assert settings.asaas_onboarding_mode == "linked"
