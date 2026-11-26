"""Página pública do produtor/organizador."""

from __future__ import annotations

import re
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, field_validator
from sqlalchemy.orm import Session

from app.services.dominio_proprio import DominioIndisponivel, checar_apontamento, definir_dominio, verificar_e_ativar
from app.services.whitelabel_acesso import acesso_whitelabel
from app.models import Usuario, get_db
from app.routes.auth import get_usuario_atual
from app.services.organizador_publico import (
    garantir_slug_publico,
    montar_perfil_publico,
    validar_brand_color,
    validar_brand_subdomain,
)
from app.utils.imagem_url import validar_imagem_url
from app.utils.url_publica import normalizar_gtm_id, normalizar_meta_pixel_id
from app.utils.url_publica import (
    normalizar_url_instagram,
    normalizar_url_whatsapp,
    validar_url_http_https,
)

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
    brand_cover_url: str | None = Field(default=None, max_length=2048)
    brand_favicon_url: str | None = Field(default=None, max_length=2048)
    brand_primary_color: str | None = Field(default=None, max_length=7)
    brand_primary_color_dark: str | None = Field(default=None, max_length=7)
    brand_subdomain: str | None = Field(default=None, max_length=63)
    brand_tema_vitrine: Literal["claro", "escuro"] | None = None
    brand_rodape_texto: str | None = Field(default=None, max_length=500)
    marketing_meta_pixel_id: str | None = Field(default=None, max_length=32)
    marketing_gtm_id: str | None = Field(default=None, max_length=32)

    @field_validator("marketing_meta_pixel_id", mode="before")
    @classmethod
    def _meta_pixel(cls, v: object) -> str | None:
        return normalizar_meta_pixel_id(v)

    @field_validator("marketing_gtm_id", mode="before")
    @classmethod
    def _gtm(cls, v: object) -> str | None:
        return normalizar_gtm_id(v)

    @field_validator("brand_rodape_texto", mode="before")
    @classmethod
    def _rodape(cls, v: object) -> str | None:
        return v.strip() or None if isinstance(v, str) else None

    @field_validator("foto_url", "brand_logo_url", "brand_cover_url", "brand_favicon_url", mode="before")
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

    @field_validator("social_instagram", mode="before")
    @classmethod
    def _url_instagram(cls, v: object) -> str | None:
        if v is None or (isinstance(v, str) and not v.strip()):
            return None
        return normalizar_url_instagram(v)

    @field_validator("social_site", mode="before")
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
        return normalizar_url_whatsapp(v)


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
        "brand_cover_url": usuario.brand_cover_url,
        "brand_favicon_url": usuario.brand_favicon_url,
        "brand_primary_color": usuario.brand_primary_color,
        "brand_primary_color_dark": usuario.brand_primary_color_dark,
        "brand_subdomain": usuario.brand_subdomain,
        "brand_tema_vitrine": usuario.brand_tema_vitrine,
        "brand_rodape_texto": usuario.brand_rodape_texto,
        "marketing_meta_pixel_id": usuario.marketing_meta_pixel_id,
        "marketing_gtm_id": usuario.marketing_gtm_id,
        "dominio_proprio": usuario.brand_custom_domain if usuario.brand_custom_domain_ativo_em else None,
        "dominio_proprio_cadastrado": usuario.brand_custom_domain,
        "dominio_proprio_acesso": acesso_whitelabel(usuario).para_json(),
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

    marketing = {"marketing_meta_pixel_id", "marketing_gtm_id"} & body.model_fields_set
    if any(getattr(body, f) for f in marketing) and not acesso_whitelabel(usuario_atual).liberado:
        raise HTTPException(status_code=409, detail="Pixel e GTM próprios fazem parte do plano com mensalidade.")

    for field in ("brand_cover_url", "brand_favicon_url", "brand_tema_vitrine", "brand_rodape_texto", *sorted(marketing)):
        if field in body.model_fields_set:
            setattr(usuario_atual, field, getattr(body, field))

    slug = garantir_slug_publico(db, usuario_atual)
    db.commit()
    db.refresh(usuario_atual)
    return {"ok": True, "slug_publico": slug, **_perfil_response(usuario_atual, slug)}


class DominioProprioUpdate(BaseModel):
    dominio: str | None = Field(default=None, max_length=253)


def _exigir_organizador(usuario: Usuario) -> None:
    if usuario.tipo != "organizador":
        raise HTTPException(status_code=403, detail="Apenas organizadores")


@router.put("/meu-perfil/dominio-proprio")
async def definir_dominio_proprio(
    body: DominioProprioUpdate,
    usuario_atual: Usuario = Depends(get_usuario_atual),
    db: Session = Depends(get_db),
):
    _exigir_organizador(usuario_atual)
    try:
        definir_dominio(db, usuario_atual, body.dominio)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except DominioIndisponivel as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    db.commit()
    db.refresh(usuario_atual)
    dominio = usuario_atual.brand_custom_domain
    return {
        **_perfil_response(usuario_atual, garantir_slug_publico(db, usuario_atual)),
        "apontamento": checar_apontamento(dominio).para_json() if dominio else None,
    }


@router.post("/meu-perfil/dominio-proprio/verificar")
async def verificar_dominio_proprio(
    usuario_atual: Usuario = Depends(get_usuario_atual),
    db: Session = Depends(get_db),
):
    _exigir_organizador(usuario_atual)
    try:
        apontamento = verificar_e_ativar(usuario_atual)
    except DominioIndisponivel as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    db.commit()
    db.refresh(usuario_atual)
    return {
        **_perfil_response(usuario_atual, garantir_slug_publico(db, usuario_atual)),
        "apontamento": apontamento.para_json(),
    }


@router.get("/{slug}")
async def obter_produtor(slug: str, db: Session = Depends(get_db)):
    perfil = montar_perfil_publico(db, slug)
    if not perfil:
        raise HTTPException(status_code=404, detail="Produtor não encontrado")
    return perfil
