from __future__ import annotations

import os
from functools import lru_cache

from sqlalchemy.orm import Session

from app.models.platform_settings import PlatformSettings
from app.schemas.platform_settings import PlatformSettingsPublic, PlatformSettingsUpdate

SETTINGS_ID = "default"

_DEFAULT_TAGLINE = "INGRESSOS · SHOWS · TRANSPARÊNCIA"
_DEFAULT_FOOTER = (
    "Ingressos, reembolsos e repasses com transparência — do primeiro clique ao dia do evento."
)


def _env(key: str) -> str | None:
    v = os.getenv(key, "").strip()
    return v or None


def _defaults() -> dict[str, str | None]:
    return {
        "site_name": "EventosBR",
        "site_tagline": _DEFAULT_TAGLINE,
        "footer_description": _DEFAULT_FOOTER,
        "contact_email": _env("NEXT_PUBLIC_EMAIL_CONTATO") or _env("EMAIL_USER"),
        "support_email": _env("NEXT_PUBLIC_EMAIL_DENUNCIAS"),
        "logo_url": _env("NEXT_PUBLIC_LOGO_URL"),
        "logo_light_url": None,
        "favicon_url": None,
        "primary_color": "#10b981",
        "primary_color_dark": "#047857",
        "social_instagram_url": _env("NEXT_PUBLIC_SOCIAL_INSTAGRAM_URL"),
        "social_whatsapp_url": _env("NEXT_PUBLIC_SOCIAL_WHATSAPP_URL"),
        "social_linkedin_url": _env("NEXT_PUBLIC_SOCIAL_LINKEDIN_URL"),
        "social_x_url": _env("NEXT_PUBLIC_SOCIAL_X_URL"),
        "social_youtube_url": _env("NEXT_PUBLIC_SOCIAL_YOUTUBE_URL"),
    }


def _merge_row(row: PlatformSettings | None) -> PlatformSettingsPublic:
    d = _defaults()
    if row is None:
        return PlatformSettingsPublic(**d)  # type: ignore[arg-type]

    def pick(field: str) -> str | None:
        val = getattr(row, field, None)
        if val is None or (isinstance(val, str) and not val.strip()):
            return d.get(field)  # type: ignore[return-value]
        return val

    return PlatformSettingsPublic(
        site_name=row.site_name or d["site_name"],  # type: ignore[arg-type]
        site_tagline=pick("site_tagline"),
        footer_description=pick("footer_description"),
        contact_email=pick("contact_email"),
        support_email=pick("support_email"),
        logo_url=pick("logo_url"),
        logo_light_url=pick("logo_light_url"),
        favicon_url=pick("favicon_url"),
        primary_color=row.primary_color or d["primary_color"],  # type: ignore[arg-type]
        primary_color_dark=row.primary_color_dark or d["primary_color_dark"],  # type: ignore[arg-type]
        social_instagram_url=pick("social_instagram_url"),
        social_whatsapp_url=pick("social_whatsapp_url"),
        social_linkedin_url=pick("social_linkedin_url"),
        social_x_url=pick("social_x_url"),
        social_youtube_url=pick("social_youtube_url"),
    )


def get_or_create_row(db: Session) -> PlatformSettings:
    row = db.get(PlatformSettings, SETTINGS_ID)
    if row is None:
        row = PlatformSettings(id=SETTINGS_ID)
        db.add(row)
        db.commit()
        db.refresh(row)
    return row


@lru_cache(maxsize=1)
def _cached_public_json() -> str | None:
    return None


def invalidate_platform_settings_cache() -> None:
    _cached_public_json.cache_clear()


def get_public_settings(db: Session) -> PlatformSettingsPublic:
    row = db.get(PlatformSettings, SETTINGS_ID)
    return _merge_row(row)


def update_settings(db: Session, body: PlatformSettingsUpdate) -> PlatformSettingsPublic:
    row = get_or_create_row(db)
    data = body.model_dump(exclude_unset=True)
    for key, value in data.items():
        setattr(row, key, value)
    db.commit()
    db.refresh(row)
    invalidate_platform_settings_cache()
    return _merge_row(row)
