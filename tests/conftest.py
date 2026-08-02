"""Garante variáveis antes de carregar a app: rate limit desligado e ambiente de teste."""

import os

import pytest

os.environ["ENVIRONMENT"] = "test"
os.environ["RATE_LIMIT_USE_REDIS"] = "false"
os.environ.setdefault("SECRET_KEY", "test-secret-key-with-at-least-32-chars-here")
os.environ.setdefault("ASAAS_DISABLED", "true")
os.environ.setdefault("PAYMENT_PROVIDER", "asaas")


@pytest.fixture(scope="session", autouse=True)
def _sync_test_db_schema():
    """Recria o schema em memória quando o modelo SQLAlchemy muda (ex.: colunas OAuth)."""
    from config.database import Base
    from tests import test_api

    Base.metadata.drop_all(bind=test_api.engine)
    Base.metadata.create_all(bind=test_api.engine)


@pytest.fixture(autouse=True)
def organizador_email_auto_verified_in_tests(request, monkeypatch):
    """Mantém a suíte existente: organizador registrado recebe token imediato nos testes."""
    if request.node.get_closest_marker("organizador_email_flow"):
        return

    def auto_verify(db, usuario):
        usuario.email_verificado = True
        usuario.email_verificacao_token = None
        usuario.email_verificacao_expires = None
        db.commit()
        return True

    monkeypatch.setattr(
        "app.routes.auth.disparar_verificacao_organizador",
        auto_verify,
    )
