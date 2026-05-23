"""Validação de ID tokens do Google."""

from __future__ import annotations

import logging

from google.auth.transport import requests as google_requests
from google.oauth2 import id_token as google_id_token

from config.settings import settings

logger = logging.getLogger(__name__)


class OAuthTokenInvalid(Exception):
    """Token OAuth inválido ou expirado."""


def oauth_google_enabled() -> bool:
    return bool((settings.GOOGLE_OAUTH_CLIENT_ID or "").strip())


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
