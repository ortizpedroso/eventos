"""Cliente Redis opcional (compartilhado por rate limit, filas, etc.)."""

from __future__ import annotations

import logging
import time
from threading import Lock

from config.settings import settings

logger = logging.getLogger(__name__)

_lock = Lock()
_client: object | None | bool = None  # None=não tentado, False=indisponível, object=Redis
# Não cachear falha para sempre — no boot o Redis do compose pode ainda não
# estar pronto; sem retry, filas ficam só em memória e e-mails "somem" entre
# workers/reinícios.
_fail_until_monotonic: float = 0.0
_FAIL_COOLDOWN_SEC = 15.0


def get_redis_optional():
    """Retorna cliente Redis ou None se indisponível / desativado."""
    global _client, _fail_until_monotonic
    if settings.ENVIRONMENT == "test":
        return None
    url = (settings.REDIS_URL or "").strip()
    if not url:
        return None
    with _lock:
        if _client is not None and _client is not False:
            return _client
        now = time.monotonic()
        if _client is False and now < _fail_until_monotonic:
            return None
        try:
            import redis

            r = redis.Redis.from_url(url, decode_responses=True, socket_connect_timeout=2)
            r.ping()
            _client = r
            _fail_until_monotonic = 0.0
            return _client
        except Exception as exc:
            logger.warning(
                "Redis indisponível (%s); usando fallback em memória (nova tentativa em %.0fs).",
                exc,
                _FAIL_COOLDOWN_SEC,
            )
            _client = False
            _fail_until_monotonic = now + _FAIL_COOLDOWN_SEC
            return None


def reset_redis_client_for_tests() -> None:
    """Permite reconfigurar o cliente entre testes."""
    global _client, _fail_until_monotonic
    with _lock:
        _client = None
        _fail_until_monotonic = 0.0
