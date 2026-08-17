"""Garante admin da plataforma para o e-mail do proprietário (EMAIL_USER)."""

from __future__ import annotations

import logging

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models import Usuario
from config.settings import settings

logger = logging.getLogger(__name__)


def ensure_platform_owner_admin(db: Session) -> None:
    """Concede is_platform_admin ao EMAIL_USER do .env se a conta existir.

    VPS single-tenant: o e-mail SMTP (EMAIL_USER) é o dono da plataforma.
    Não revoga admins existentes — só garante que o proprietário tenha o papel.
    """
    email = (settings.EMAIL_USER or "").strip().lower()
    if not email:
        logger.info(
            "bootstrap_platform_admin: EMAIL_USER vazio — "
            "use scripts/set_platform_admin.py <email> se precisar"
        )
        return

    usuario = db.query(Usuario).filter(func.lower(Usuario.email) == email).first()
    if not usuario:
        logger.warning(
            "bootstrap_platform_admin: conta %s não existe — cadastre no site primeiro",
            email,
        )
        return

    if usuario.is_platform_admin:
        return

    usuario.is_platform_admin = True
    db.commit()
    logger.info("bootstrap_platform_admin: is_platform_admin concedido a %s", email)
