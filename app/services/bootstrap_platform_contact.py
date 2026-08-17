"""Preenche telefone/WhatsApp da plataforma — .env, banco ou perfil do dono."""

from __future__ import annotations

import logging
import re

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models import Usuario
from app.services.bootstrap_platform_admin import _owner_emails
from app.services.platform_settings import (
    get_or_create_row,
    get_public_settings,
    invalidate_platform_settings_cache,
)
from app.utils.url_publica import normalizar_url_whatsapp

logger = logging.getLogger(__name__)


def _digits_phone(raw: str | None) -> str | None:
    digits = re.sub(r"\D", "", raw or "").strip()
    if len(digits) < 10:
        return None
    if len(digits) > 11 and digits.startswith("55"):
        digits = digits[-11:]
    return digits


def _discover_contact_phone(db: Session) -> tuple[str | None, str | None]:
    """Descobre telefone e URL WhatsApp sem input manual (.env → DB → perfil do dono)."""
    from app.services.platform_settings import _defaults, _merge_row

    defaults = _defaults()
    phone = _digits_phone(defaults.get("contact_phone"))
    whatsapp = (defaults.get("social_whatsapp_url") or "").strip() or None

    row = get_or_create_row(db)
    pub = _merge_row(row)

    if not phone:
        phone = _digits_phone(pub.contact_phone)
    if not whatsapp and pub.social_whatsapp_url:
        whatsapp = pub.social_whatsapp_url.strip()

    if not phone and whatsapp:
        phone = _digits_phone(whatsapp)

    if not phone:
        for email in _owner_emails():
            usuario = db.query(Usuario).filter(func.lower(Usuario.email) == email).first()
            phone = _digits_phone(usuario.telefone if usuario else None)
            if phone:
                break

    if not phone:
        org = (
            db.query(Usuario)
            .filter(
                Usuario.tipo == "organizador",
                Usuario.ativo.is_(True),
                Usuario.telefone.isnot(None),
                Usuario.telefone != "",
            )
            .order_by(Usuario.data_criacao.asc())
            .first()
        )
        phone = _digits_phone(org.telefone if org else None)

    if phone and not whatsapp:
        whatsapp = normalizar_url_whatsapp(phone)

    return phone, whatsapp


def ensure_platform_contact_from_env(db: Session) -> None:
    """Persiste contact_phone / social_whatsapp_url quando a linha default está vazia."""
    phone, whatsapp = _discover_contact_phone(db)
    if not phone and not whatsapp:
        logger.info(
            "bootstrap_platform_contact: telefone não encontrado (.env, banco ou perfil do organizador)"
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
        phone or "-",
        "ok" if whatsapp else "-",
    )


def platform_contact_status(db: Session) -> dict[str, object]:
    """Estado público para scripts de deploy (verificação automatizada)."""
    pub = get_public_settings(db)
    admins = db.query(Usuario).filter(Usuario.is_platform_admin.is_(True)).count()
    return {
        "contact_phone": pub.contact_phone,
        "social_whatsapp_url": pub.social_whatsapp_url,
        "platform_admins": admins,
        "whatsapp_ok": bool(pub.contact_phone or pub.social_whatsapp_url),
        "admin_ok": admins > 0,
    }
