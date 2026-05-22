"""Validação de ID tokens do Google e Apple."""

from __future__ import annotations

import logging
from functools import lru_cache

import httpx
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token as google_id_token
from jose import jwk, jwt
from jose.exceptions import JWTError

from config.settings import settings

logger = logging.getLogger(__name__)

APPLE_ISSUER = "https://appleid.apple.com"
APPLE_JWKS_URL = "https://appleid.apple.com/auth/keys"


class OAuthTokenInvalid(Exception):
    """Token OAuth inválido ou expirado."""


def oauth_google_enabled() -> bool:
    return bool((settings.GOOGLE_OAUTH_CLIENT_ID or "").strip())


def oauth_apple_enabled() -> bool:
    return bool((settings.APPLE_OAUTH_CLIENT_ID or "").strip())


def verify_google_id_token(token: str) -> dict:
    client_id = (settings.GOOGLE_OAUTH_CLIENT_ID or "").strip()
    if not client_id:
        raise OAuthTokenInvalid("Login com Google não configurado na API.")
    try:
        payload = google_id_token.verify_oauth2_token(
            token,
            google_requests.Request(),
            client_id,
        )
    except ValueError as e:
        logger.warning("Google ID token inválido: %s", e)
        raise OAuthTokenInvalid("Token Google inválido ou expirado.") from e
    if not payload.get("email"):
        raise OAuthTokenInvalid("O Google não forneceu email para esta conta.")
    if payload.get("email_verified") is False:
        raise OAuthTokenInvalid("Email Google não verificado.")
    return payload


@lru_cache(maxsize=1)
def _apple_jwks() -> dict:
    with httpx.Client(timeout=10.0) as client:
        r = client.get(APPLE_JWKS_URL)
        r.raise_for_status()
        return r.json()


def verify_apple_id_token(token: str) -> dict:
    client_id = (settings.APPLE_OAUTH_CLIENT_ID or "").strip()
    if not client_id:
        raise OAuthTokenInvalid("Login com Apple não configurado na API.")
    try:
        header = jwt.get_unverified_header(token)
        kid = header.get("kid")
        keys = _apple_jwks().get("keys") or []
        key_data = next((k for k in keys if k.get("kid") == kid), None)
        if not key_data:
            raise OAuthTokenInvalid("Chave pública Apple não encontrada.")
        public_key = jwk.construct(key_data)
        payload = jwt.decode(
            token,
            public_key,
            algorithms=[key_data.get("alg", "RS256")],
            audience=client_id,
            issuer=APPLE_ISSUER,
        )
    except JWTError as e:
        logger.warning("Apple ID token inválido: %s", e)
        raise OAuthTokenInvalid("Token Apple inválido ou expirado.") from e
    return payload
