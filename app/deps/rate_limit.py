"""Limite por IP: Redis (opcional) ou janela em memória. Ativo fora de development/test."""

from __future__ import annotations

import logging
import time
from collections import defaultdict
from threading import Lock

from fastapi import HTTPException, Request

from config.settings import settings

logger = logging.getLogger(__name__)

_lock = Lock()
_events: dict[str, list[float]] = defaultdict(list)

_redis_lock = Lock()
_redis_client: object | None | bool = None  # None=não tentado, False=falhou, object=cliente Redis

# bucket -> (máximo de pedidos, janela em segundos)
_LIMITS: dict[str, tuple[int, int]] = {
    "auth_login": (30, 60),
    "auth_register": (10, 60),
    "checkout_criar": (25, 60),
}


def _rate_limit_active() -> bool:
    return settings.ENVIRONMENT not in ("development", "test")


def _client_ip(request: Request) -> str:
    if settings.TRUST_FORWARDED_HEADERS:
        fwd = request.headers.get("x-forwarded-for")
        if fwd:
            return fwd.split(",")[0].strip() or "unknown"
    if request.client and request.client.host:
        return request.client.host
    return "unknown"


def _get_redis():
    global _redis_client
    if not settings.RATE_LIMIT_USE_REDIS or not (settings.REDIS_URL or "").strip():
        return None
    with _redis_lock:
        if _redis_client is False:
            return None
        if _redis_client is not None:
            return _redis_client
        try:
            import redis

            r = redis.Redis.from_url(
                settings.REDIS_URL,
                socket_connect_timeout=0.35,
                socket_timeout=0.35,
                decode_responses=True,
            )
            r.ping()
            _redis_client = r
            logger.info("Rate limit: a usar Redis em %s", settings.REDIS_URL.split("@")[-1])
            return r
        except Exception as exc:
            logger.warning("Rate limit: Redis indisponível (%s); a usar memória no processo", exc)
            _redis_client = False
            return None


def _enforce_memory(key: str, max_hits: int, window_sec: int) -> None:
    now = time.monotonic()
    with _lock:
        lst = _events[key]
        lst[:] = [t for t in lst if now - t < window_sec]
        if len(lst) >= max_hits:
            logger.warning("Rate limit excedido (memória): %s", key)
            raise HTTPException(
                status_code=429,
                detail="Muitas tentativas. Aguarde um minuto e tente novamente.",
            )
        lst.append(now)


def _enforce_redis(r, redis_key: str, max_hits: int, window_sec: int) -> None:
    try:
        n = int(r.incr(redis_key))
        if n == 1:
            r.expire(redis_key, window_sec)
        if n > max_hits:
            r.decr(redis_key)
            logger.warning("Rate limit excedido (Redis): %s", redis_key)
            raise HTTPException(
                status_code=429,
                detail="Muitas tentativas. Aguarde um minuto e tente novamente.",
            )
    except HTTPException:
        raise
    except Exception as exc:
        logger.warning("Rate limit Redis falhou (%s); fallback memória", exc)
        _enforce_memory(redis_key, max_hits, window_sec)


def enforce_rate_limit(request: Request, bucket: str) -> None:
    if not _rate_limit_active():
        return
    spec = _LIMITS.get(bucket)
    if not spec:
        return
    max_hits, window_sec = spec
    ip = _client_ip(request)
    redis_key = f"rl:v1:{bucket}:{ip}"

    r = _get_redis()
    if r is not None:
        _enforce_redis(r, redis_key, max_hits, window_sec)
    else:
        _enforce_memory(f"{bucket}:{ip}", max_hits, window_sec)


def rate_limit_login(request: Request) -> None:
    enforce_rate_limit(request, "auth_login")


def rate_limit_register(request: Request) -> None:
    enforce_rate_limit(request, "auth_register")


def rate_limit_oauth(request: Request) -> None:
    enforce_rate_limit(request, "auth_login")


def rate_limit_checkout(request: Request) -> None:
    enforce_rate_limit(request, "checkout_criar")
