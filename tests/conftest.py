"""Garante variáveis antes de carregar a app: rate limit desligado e ambiente de teste."""

import os

import pytest

os.environ["ENVIRONMENT"] = "test"
os.environ["RATE_LIMIT_USE_REDIS"] = "false"
os.environ.setdefault("SECRET_KEY", "test-secret-key-with-at-least-32-chars-here")
os.environ.setdefault("STRIPE_DISABLED", "true")
os.environ.setdefault("STRIPE_SKIP_CONNECT_ON_REGISTER", "true")


@pytest.fixture(scope="session", autouse=True)
def _sync_test_db_schema():
    """Recria o schema em memória quando o modelo SQLAlchemy muda (ex.: colunas OAuth)."""
    from config.database import Base
    from tests import test_api

    Base.metadata.drop_all(bind=test_api.engine)
    Base.metadata.create_all(bind=test_api.engine)
