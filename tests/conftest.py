"""Garante variáveis antes de carregar a app: rate limit desligado e ambiente de teste."""

import os

os.environ["ENVIRONMENT"] = "test"
os.environ["RATE_LIMIT_USE_REDIS"] = "false"
