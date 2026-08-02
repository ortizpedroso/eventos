from __future__ import annotations

import re
from typing import Literal

from pydantic import BaseModel, Field, field_validator

from app.utils.imagem_url import validar_imagem_url
from app.utils.url_publica import (
    normalizar_gtm_id,
    normalizar_meta_pixel_id,
    normalizar_url_instagram,
    normalizar_url_whatsapp,
    validar_url_http_https,
)

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
        # Aceita linkedin.com/... sem esquema
        if re.match(r"^(www\.)?(linkedin\.com|x\.com|twitter\.com|youtube\.com|youtu\.be)/", s, re.I):
            return validar_url_http_https("https://" + s.lstrip("/"))
        raise ValueError("URL deve começar com http:// ou https://")
    return validar_url_http_https(s)


class PlatformSettingsPublic(BaseModel):
    site_name: str
    site_tagline: str | None = None
    footer_description: str | None = None
    contact_email: str | None = None
    contact_phone: str | None = None
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
    meta_pixel_id: str | None = None
    gtm_id: str | None = None


class PlatformSettingsUpdate(BaseModel):
    site_name: str | None = Field(default=None, min_length=1, max_length=120)
    site_tagline: str | None = Field(default=None, max_length=255)
    footer_description: str | None = None
    contact_email: str | None = Field(default=None, max_length=255)
    contact_phone: str | None = Field(default=None, max_length=20)
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
    meta_pixel_id: str | None = None
    gtm_id: str | None = None

    @field_validator("meta_pixel_id", mode="before")
    @classmethod
    def _meta_pixel(cls, v: object) -> str | None:
        return normalizar_meta_pixel_id(v)

    @field_validator("gtm_id", mode="before")
    @classmethod
    def _gtm(cls, v: object) -> str | None:
        return normalizar_gtm_id(v)

    @field_validator("logo_url", "logo_light_url", "favicon_url", mode="before")
    @classmethod
    def _asset_url(cls, v: object) -> str | None:
        return validar_imagem_url(v)

    @field_validator("social_instagram_url", mode="before")
    @classmethod
    def _social_instagram(cls, v: object) -> str | None:
        return normalizar_url_instagram(v)

    @field_validator("social_whatsapp_url", mode="before")
    @classmethod
    def _social_whatsapp(cls, v: object) -> str | None:
        return normalizar_url_whatsapp(v)

    @field_validator(
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
