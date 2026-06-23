"""Autenticação para rotas administrativas da plataforma (exportações internas)."""

from __future__ import annotations

import secrets

from fastapi import Header, HTTPException

from config.settings import settings


async def require_platform_admin(
    x_platform_admin_key: str | None = Header(default=None, alias="X-Platform-Admin-Key"),
) -> None:
    expected = (settings.PLATFORM_ADMIN_API_KEY or "").strip()
    if not expected:
        raise HTTPException(
            status_code=503,
            detail="Exportação administrativa desativada. Defina PLATFORM_ADMIN_API_KEY no .env da API.",
        )
    received = (x_platform_admin_key or "").strip()
    if not received or not secrets.compare_digest(received, expected):
        raise HTTPException(status_code=401, detail="Chave de administrador inválida.")


async def optional_platform_admin(
    x_platform_admin_key: str | None = Header(default=None, alias="X-Platform-Admin-Key"),
) -> bool:
    """True quando o header de admin da plataforma é válido."""
    expected = (settings.PLATFORM_ADMIN_API_KEY or "").strip()
    received = (x_platform_admin_key or "").strip()
    if not expected or not received:
        return False
    return secrets.compare_digest(received, expected)
