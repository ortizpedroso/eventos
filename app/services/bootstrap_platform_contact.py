"""Preenche telefone/WhatsApp da plataforma a partir do .env quando o banco está vazio."""

from __future__ import annotations

import logging

from sqlalchemy.orm import Session

from app.services.platform_settings import get_or_create_row, invalidate_platform_settings_cache

logger = logging.getLogger(__name__)


def ensure_platform_contact_from_env(db: Session) -> None:
    """Persiste contact_phone / social_whatsapp_url do .env se a linha default estiver vazia."""
    from app.services.platform_settings import _defaults

    defaults = _defaults()
    phone = (defaults.get("contact_phone") or "").strip()
    whatsapp = (defaults.get("social_whatsapp_url") or "").strip()
    if not phone and not whatsapp:
        logger.info(
            "bootstrap_platform_contact: TELEFONE_CONTATO / NEXT_PUBLIC_SOCIAL_WHATSAPP_URL "
            "vazios — configure no .env ou Admin → Configurações"
        )
        return

    row = get_or_create_row(db)
    changed = False

    if phone and not (row.contact_phone or "").strip():
        row.contact_phone = phone
        changed = True

    if whatsapp and not (row.social_whatsapp_url or "").strip():
        row.social_whatsapp_url = whatsapp
        changed = True

    if not changed:
        return

    db.commit()
    invalidate_platform_settings_cache()
    logger.info(
        "bootstrap_platform_contact: contact_phone=%s social_whatsapp_url=%s",
        "ok" if phone else "-",
        "ok" if whatsapp else "-",
    )
