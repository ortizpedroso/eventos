"""Cliente Redis opcional (compartilhado por rate limit, filas, etc.)."""

from __future__ import annotations

import logging
from threading import Lock

from config.settings import settings

logger = logging.getLogger(__name__)

_lock = Lock()
_client: object | None | bool = None  # None=não tentado, False=indisponível, object=Redis


def get_redis_optional():
    """Retorna cliente Redis ou None se indisponível / desativado."""
    global _client
    if settings.ENVIRONMENT == "test":
        return None
    url = (settings.REDIS_URL or "").strip()
    if not url:
        return None
    with _lock:
        if _client is False:
            return None
        if _client is not None:
            return _client
        try:
            import redis

            r = redis.Redis.from_url(url, decode_responses=True, socket_connect_timeout=2)
            r.ping()
            _client = r
            return _client
        except Exception as exc:
            logger.warning("Redis indisponível (%s); usando fallback em memória.", exc)
            _client = False
            return None


def reset_redis_client_for_tests() -> None:
    """Permite reconfigurar o cliente entre testes."""
    global _client
    with _lock:
        _client = None
