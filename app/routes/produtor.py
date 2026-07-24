"""Página pública do produtor/organizador."""

from __future__ import annotations

import re

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, field_validator
from sqlalchemy.orm import Session

from app.models import Usuario, get_db
from app.routes.auth import get_usuario_atual
from app.services.organizador_publico import (
    garantir_slug_publico,
    montar_perfil_publico,
    validar_brand_color,
    validar_brand_subdomain,
)
from app.utils.imagem_url import validar_imagem_url
from app.utils.url_publica import validar_url_http_https, validar_url_whatsapp

router = APIRouter()

_HEX_COLOR = re.compile(r"^#[0-9A-Fa-f]{6}$")


class PerfilPublicoUpdate(BaseModel):
    bio: str | None = Field(default=None, max_length=2000)
    foto_url: str | None = Field(default=None, max_length=2048)
    social_instagram: str | None = Field(default=None, max_length=500)
    social_whatsapp: str | None = Field(default=None, max_length=500)
    social_site: str | None = Field(default=None, max_length=500)
    brand_name: str | None = Field(default=None, max_length=120)
    brand_logo_url: str | None = Field(default=None, max_length=2048)
    brand_primary_color: str | None = Field(default=None, max_length=7)
    brand_primary_color_dark: str | None = Field(default=None, max_length=7)
    brand_subdomain: str | None = Field(default=None, max_length=63)

    @field_validator("foto_url", "brand_logo_url", mode="before")
    @classmethod
    def _foto_url(cls, v: object) -> str | None:
        return validar_imagem_url(v)

    @field_validator("brand_primary_color", "brand_primary_color_dark", mode="before")
    @classmethod
    def _brand_color(cls, v: object) -> str | None:
        return validar_brand_color(v if isinstance(v, str) else None)

    @field_validator("brand_subdomain", mode="before")
    @classmethod
    def _brand_subdomain(cls, v: object) -> str | None:
        return validar_brand_subdomain(v if isinstance(v, str) else None)

    @field_validator("social_instagram", "social_site", mode="before")
    @classmethod
    def _url_http(cls, v: object) -> str | None:
        if v is None or (isinstance(v, str) and not v.strip()):
            return None
        return validar_url_http_https(v)

    @field_validator("social_whatsapp", mode="before")
    @classmethod
    def _url_whatsapp(cls, v: object) -> str | None:
        if v is None or (isinstance(v, str) and not v.strip()):
            return None
        return validar_url_whatsapp(v)


def _perfil_response(usuario: Usuario, slug: str) -> dict:
    return {
        "slug_publico": slug,
        "bio": usuario.bio,
        "foto_url": usuario.foto_url,
        "social_instagram": usuario.social_instagram,
        "social_whatsapp": usuario.social_whatsapp,
        "social_site": usuario.social_site,
        "brand_name": usuario.brand_name,
        "brand_logo_url": usuario.brand_logo_url,
        "brand_primary_color": usuario.brand_primary_color,
        "brand_primary_color_dark": usuario.brand_primary_color_dark,
        "brand_subdomain": usuario.brand_subdomain,
    }


@router.get("/meu-perfil")
async def obter_meu_perfil_publico(
    usuario_atual: Usuario = Depends(get_usuario_atual),
    db: Session = Depends(get_db),
):
    if usuario_atual.tipo != "organizador":
        raise HTTPException(status_code=403, detail="Apenas organizadores")
    slug = garantir_slug_publico(db, usuario_atual)
    db.commit()
    return _perfil_response(usuario_atual, slug)


@router.patch("/meu-perfil")
async def atualizar_perfil_publico(
    body: PerfilPublicoUpdate,
    usuario_atual: Usuario = Depends(get_usuario_atual),
    db: Session = Depends(get_db),
):
    if usuario_atual.tipo != "organizador":
        raise HTTPException(status_code=403, detail="Apenas organizadores")

    if body.brand_subdomain is not None:
        sub = body.brand_subdomain
        if sub:
            existing = (
                db.query(Usuario)
                .filter(Usuario.brand_subdomain == sub, Usuario.id != usuario_atual.id)
                .first()
            )
            if existing:
                raise HTTPException(status_code=409, detail="Subdomínio já em uso")
        usuario_atual.brand_subdomain = sub

    for field in (
        "bio",
        "foto_url",
        "social_instagram",
        "social_whatsapp",
        "social_site",
        "brand_name",
        "brand_logo_url",
        "brand_primary_color",
        "brand_primary_color_dark",
    ):
        val = getattr(body, field)
        if val is not None:
            if field == "bio":
                usuario_atual.bio = val.strip()[:2000] if val else None
            elif field == "brand_name":
                usuario_atual.brand_name = val.strip()[:120] if val else None
            else:
                setattr(usuario_atual, field, val)

    slug = garantir_slug_publico(db, usuario_atual)
    db.commit()
    db.refresh(usuario_atual)
    return {"ok": True, "slug_publico": slug, **_perfil_response(usuario_atual, slug)}


@router.get("/{slug}")
async def obter_produtor(slug: str, db: Session = Depends(get_db)):
    perfil = montar_perfil_publico(db, slug)
    if not perfil:
        raise HTTPException(status_code=404, detail="Produtor não encontrado")
    return perfil
