"""Garante admin da plataforma para o e-mail do proprietário."""

from __future__ import annotations

import logging
import os

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models import Usuario
from config.settings import settings

logger = logging.getLogger(__name__)


def _owner_emails() -> list[str]:
    """E-mails candidatos a receber is_platform_admin no boot (ordem de prioridade)."""
    seen: set[str] = set()
    out: list[str] = []
    for raw in (
        settings.PLATFORM_OWNER_EMAIL,
        settings.EMAIL_USER,
        os.getenv("NEXT_PUBLIC_EMAIL_CONTATO", ""),
    ):
        email = (raw or "").strip().lower()
        if not email or email in seen:
            continue
        seen.add(email)
        out.append(email)
    return out


def _grant_admin(db: Session, usuario: Usuario, motivo: str) -> bool:
    if usuario.is_platform_admin:
        return False
    usuario.is_platform_admin = True
    db.commit()
    logger.info("bootstrap_platform_admin: is_platform_admin concedido a %s (%s)", usuario.email, motivo)
    return True


def ensure_platform_owner_admin(db: Session) -> None:
    """Concede is_platform_admin ao proprietário se a conta existir.

    Ordem: PLATFORM_OWNER_EMAIL → EMAIL_USER → NEXT_PUBLIC_EMAIL_CONTATO.
    Fallback single-tenant: se ninguém tem admin ainda, concede ao organizador
    mais antigo (VPS com uma conta de dono).
    """
    for email in _owner_emails():
        usuario = db.query(Usuario).filter(func.lower(Usuario.email) == email).first()
        if not usuario:
            logger.warning(
                "bootstrap_platform_admin: conta %s não existe — cadastre no site ou defina PLATFORM_OWNER_EMAIL",
                email,
            )
            continue
        if _grant_admin(db, usuario, "owner env"):
            return

    if db.query(Usuario).filter(Usuario.is_platform_admin.is_(True)).count() > 0:
        return

    fallback = (
        db.query(Usuario)
        .filter(Usuario.tipo == "organizador", Usuario.ativo.is_(True))
        .order_by(Usuario.data_criacao.asc())
        .first()
    )
    if fallback:
        _grant_admin(
            db,
            fallback,
            "único organizador (nenhum admin na plataforma)",
        )
        return

    logger.info(
        "bootstrap_platform_admin: nenhum admin configurado — "
        "use PLATFORM_OWNER_EMAIL no .env ou scripts/set_platform_admin.py <email>"
    )
