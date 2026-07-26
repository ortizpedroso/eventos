"""Autenticação para rotas administrativas da plataforma.

Duas vias aceitas (spec: specs/admin-integrado-usuario.md):
1. Sessão de usuário normal (cookie ou Bearer) com is_platform_admin=True e
   totp_ativado=True — caminho principal, dia a dia.
2. X-Platform-Admin-Key (chave estática) — acesso de emergência/backup, mantido
   sem exigir 2FA (é o "break glass" caso a conta do dono fique inacessível).
"""

from __future__ import annotations

import secrets

from fastapi import Depends, Header, HTTPException, Request
from sqlalchemy.orm import Session

from app.models import Usuario, get_db
from app.services.auth import decode_token_payload
from app.utils.auth_cookie import AUTH_COOKIE_NAME
from config.settings import settings


def _static_key_valida(x_platform_admin_key: str | None) -> bool:
    expected = (settings.PLATFORM_ADMIN_API_KEY or "").strip()
    received = (x_platform_admin_key or "").strip()
    if not expected or not received:
        return False
    return secrets.compare_digest(received, expected)


def _token_da_requisicao(request: Request) -> str | None:
    auth_header = request.headers.get("authorization", "")
    if auth_header.lower().startswith("bearer "):
        return auth_header[7:].strip() or None
    cookie = request.cookies.get(AUTH_COOKIE_NAME)
    return cookie.strip() if cookie and cookie.strip() else None


def usuario_admin_da_sessao(request: Request, db: Session) -> Usuario | None:
    """Usuário autenticado (sessão normal) com is_platform_admin=True e 2FA ativo.

    None se não houver sessão, se a conta não for admin, ou se 2FA não estiver ativo
    (2FA é obrigatório para acesso admin via sessão — a chave estática não exige).
    """
    token = _token_da_requisicao(request)
    if not token:
        return None
    payload = decode_token_payload(token)
    if not payload:
        return None
    usuario_id = payload.get("sub")
    if not usuario_id:
        return None
    usuario = db.get(Usuario, usuario_id)
    if not usuario or not usuario.ativo:
        return None
    tv_token = int(payload.get("tv", 0) or 0)
    if tv_token != int(usuario.token_version or 0):
        return None
    if not usuario.is_platform_admin:
        return None
    if not usuario.totp_ativado:
        return None
    return usuario


async def require_platform_admin(
    request: Request,
    x_platform_admin_key: str | None = Header(default=None, alias="X-Platform-Admin-Key"),
    db: Session = Depends(get_db),
) -> None:
    if _static_key_valida(x_platform_admin_key):
        return
    admin_usuario = usuario_admin_da_sessao(request, db)
    if admin_usuario is not None:
        return

    # Mensagem diferenciada: se a conta É admin mas falta 2FA, orienta a ativar —
    # em vez do genérico "chave inválida" (mais claro para quem já está logado).
    token = _token_da_requisicao(request)
    if token:
        payload = decode_token_payload(token)
        if payload and payload.get("sub"):
            usuario = db.get(Usuario, payload["sub"])
            if usuario and usuario.is_platform_admin and not usuario.totp_ativado:
                raise HTTPException(
                    status_code=403,
                    detail="Ative a verificação em duas etapas (2FA) na sua conta para acessar o painel administrativo.",
                )

    expected = (settings.PLATFORM_ADMIN_API_KEY or "").strip()
    if not expected and not x_platform_admin_key:
        raise HTTPException(status_code=401, detail="Faça login em uma conta com acesso administrativo.")
    raise HTTPException(status_code=401, detail="Chave de administrador inválida.")


async def optional_platform_admin(
    x_platform_admin_key: str | None = Header(default=None, alias="X-Platform-Admin-Key"),
) -> bool:
    """True quando o header de admin da plataforma é válido (só checa a chave estática)."""
    return _static_key_valida(x_platform_admin_key)
