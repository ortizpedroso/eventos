"""Página pública do produtor/organizador."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, field_validator
from sqlalchemy.orm import Session

from app.models import Usuario, get_db
from app.routes.auth import get_usuario_atual
from app.services.organizador_publico import garantir_slug_publico, montar_perfil_publico
from app.utils.imagem_url import validar_imagem_url
from app.utils.url_publica import validar_url_http_https, validar_url_whatsapp

router = APIRouter()


class PerfilPublicoUpdate(BaseModel):
    bio: str | None = Field(default=None, max_length=2000)
    foto_url: str | None = Field(default=None, max_length=2048)
    social_instagram: str | None = Field(default=None, max_length=500)
    social_whatsapp: str | None = Field(default=None, max_length=500)
    social_site: str | None = Field(default=None, max_length=500)

    @field_validator("foto_url", mode="before")
    @classmethod
    def _foto_url(cls, v: object) -> str | None:
        return validar_imagem_url(v)

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


@router.get("/meu-perfil")
async def obter_meu_perfil_publico(
    usuario_atual: Usuario = Depends(get_usuario_atual),
    db: Session = Depends(get_db),
):
    if usuario_atual.tipo != "organizador":
        raise HTTPException(status_code=403, detail="Apenas organizadores")
    slug = garantir_slug_publico(db, usuario_atual)
    db.commit()
    return {
        "slug_publico": slug,
        "bio": usuario_atual.bio,
        "foto_url": usuario_atual.foto_url,
        "social_instagram": usuario_atual.social_instagram,
        "social_whatsapp": usuario_atual.social_whatsapp,
        "social_site": usuario_atual.social_site,
    }


@router.patch("/meu-perfil")
async def atualizar_perfil_publico(
    body: PerfilPublicoUpdate,
    usuario_atual: Usuario = Depends(get_usuario_atual),
    db: Session = Depends(get_db),
):
    if usuario_atual.tipo != "organizador":
        raise HTTPException(status_code=403, detail="Apenas organizadores")
    if body.bio is not None:
        usuario_atual.bio = body.bio.strip()[:2000] if body.bio else None
    if body.foto_url is not None:
        usuario_atual.foto_url = body.foto_url
    if body.social_instagram is not None:
        usuario_atual.social_instagram = body.social_instagram
    if body.social_whatsapp is not None:
        usuario_atual.social_whatsapp = body.social_whatsapp
    if body.social_site is not None:
        usuario_atual.social_site = body.social_site
    slug = garantir_slug_publico(db, usuario_atual)
    db.commit()
    db.refresh(usuario_atual)
    return {"ok": True, "slug_publico": slug}


@router.get("/{slug}")
async def obter_produtor(slug: str, db: Session = Depends(get_db)):
    perfil = montar_perfil_publico(db, slug)
    if not perfil:
        raise HTTPException(status_code=404, detail="Produtor não encontrado")
    return perfil
