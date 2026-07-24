from __future__ import annotations

import re
from typing import Literal

from pydantic import BaseModel, Field, field_validator

from app.utils.imagem_url import validar_imagem_url

_HEX_COLOR = re.compile(r"^#[0-9A-Fa-f]{6}$")


def _optional_url(v: object) -> str | None:
    if v is None:
        return None
    if not isinstance(v, str):
        raise ValueError("URL inválida")
    s = v.strip()
    if not s or s == "#":
        return None
    if not s.startswith(("http://", "https://")):
        raise ValueError("URL deve começar com http:// ou https://")
    return s


class PlatformSettingsPublic(BaseModel):
    site_name: str
    site_tagline: str | None = None
    footer_description: str | None = None
    contact_email: str | None = None
    support_email: str | None = None
    logo_url: str | None = None
    logo_light_url: str | None = None
    favicon_url: str | None = None
    primary_color: str
    primary_color_dark: str
    social_instagram_url: str | None = None
    social_whatsapp_url: str | None = None
    social_linkedin_url: str | None = None
    social_x_url: str | None = None
    social_youtube_url: str | None = None


class PlatformSettingsUpdate(BaseModel):
    site_name: str | None = Field(default=None, min_length=1, max_length=120)
    site_tagline: str | None = Field(default=None, max_length=255)
    footer_description: str | None = None
    contact_email: str | None = Field(default=None, max_length=255)
    support_email: str | None = Field(default=None, max_length=255)
    logo_url: str | None = None
    logo_light_url: str | None = None
    favicon_url: str | None = None
    primary_color: str | None = None
    primary_color_dark: str | None = None
    social_instagram_url: str | None = None
    social_whatsapp_url: str | None = None
    social_linkedin_url: str | None = None
    social_x_url: str | None = None
    social_youtube_url: str | None = None

    @field_validator("logo_url", "logo_light_url", "favicon_url", mode="before")
    @classmethod
    def _asset_url(cls, v: object) -> str | None:
        return validar_imagem_url(v)

    @field_validator(
        "social_instagram_url",
        "social_whatsapp_url",
        "social_linkedin_url",
        "social_x_url",
        "social_youtube_url",
        mode="before",
    )
    @classmethod
    def _social(cls, v: object) -> str | None:
        return _optional_url(v)

    @field_validator("primary_color", "primary_color_dark", mode="before")
    @classmethod
    def _hex(cls, v: object) -> str | None:
        if v is None:
            return None
        if not isinstance(v, str):
            raise ValueError("Cor inválida")
        s = v.strip()
        if not _HEX_COLOR.match(s):
            raise ValueError("Cor deve ser hexadecimal (#RRGGBB)")
        return s.lower()


class PlatformSettingsAdmin(PlatformSettingsPublic):
    updated_at: str | None = None
