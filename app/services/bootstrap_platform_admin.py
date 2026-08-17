"""Garante que o dono da plataforma tenha is_platform_admin quando ninguém tem."""

from __future__ import annotations

import logging

from sqlalchemy.orm import Session

from app.models import Usuario
from config.settings import settings

logger = logging.getLogger(__name__)


def ensure_platform_owner_admin(db: Session) -> None:
    """Concede admin à conta de EMAIL_USER se ainda não existir nenhum admin.

    Só roda quando zero usuários têm is_platform_admin=True — bootstrap seguro
    após restore/migração, sem revogar admins existentes.
    """
    if db.query(Usuario.id).filter(Usuario.is_platform_admin.is_(True)).first():
        return

    email = (settings.EMAIL_USER or "").strip().lower()
    if not email:
        logger.info(
            "bootstrap_platform_admin: nenhum admin e EMAIL_USER vazio — "
            "use scripts/set_platform_admin.py <email>"
        )
        return

    usuario = db.query(Usuario).filter(Usuario.email == email).first()
    if not usuario:
        logger.warning(
            "bootstrap_platform_admin: nenhum admin e conta %s não existe — "
            "cadastre no site e rode scripts/set_platform_admin.py",
            email,
        )
        return

    if usuario.is_platform_admin:
        return

    usuario.is_platform_admin = True
    db.commit()
    logger.info("bootstrap_platform_admin: is_platform_admin concedido a %s", email)
