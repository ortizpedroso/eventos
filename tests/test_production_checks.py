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
    finally:
        settings.ENVIRONMENT = prev
