"""Verificação de CAPTCHA via Cloudflare Turnstile.

Documentação: https://developers.cloudflare.com/turnstile/get-started/server-side-validation/
"""

from __future__ import annotations

import logging

import httpx

from config.settings import settings

logger = logging.getLogger(__name__)

_VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify"


def turnstile_habilitado() -> bool:
    return bool((settings.TURNSTILE_SECRET_KEY or "").strip())


async def verificar_turnstile(token: str | None, remote_ip: str | None = None) -> bool:
    """True se o token for válido. Se a feature não estiver configurada, não bloqueia (feature opt-in)."""
    if not turnstile_habilitado():
        return True

    token = (token or "").strip()
    if not token:
        return False

    payload = {"secret": settings.TURNSTILE_SECRET_KEY, "response": token}
    if remote_ip:
        payload["remoteip"] = remote_ip

    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            resp = await client.post(_VERIFY_URL, data=payload)
        if not resp.is_success:
            logger.error("siteverify HTTP %s", resp.status_code)
            return False
        data = resp.json()
        return bool(data.get("success"))
    except (httpx.HTTPError, ValueError):
        logger.error("Falha ao verificar Turnstile (rede/parse)", exc_info=True)
        # Fail-closed: se não conseguimos validar, não deixamos passar.
        return False
