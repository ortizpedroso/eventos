"""Cookie HttpOnly para sessão JWT (alternativa ao Bearer no browser)."""

from __future__ import annotations

from fastapi import Response

from config.settings import settings

AUTH_COOKIE_NAME = "eventosbr_session"


def _cookie_secure() -> bool:
    if settings.ENVIRONMENT in ("development", "test"):
        return False
    # Only use Secure flag when actually served over HTTPS.
    # In local Docker setups ENVIRONMENT=production is common but the app
    # runs on plain HTTP, so the browser would silently drop the cookie.
    return settings.FRONTEND_PUBLIC_URL.startswith("https://")


def set_auth_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        key=AUTH_COOKIE_NAME,
        value=token,
        httponly=True,
        secure=_cookie_secure(),
        samesite="lax",
        max_age=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        path="/",
    )


def clear_auth_cookie(response: Response) -> None:
    response.delete_cookie(
        key=AUTH_COOKIE_NAME,
        path="/",
        httponly=True,
        secure=_cookie_secure(),
        samesite="lax",
    )
