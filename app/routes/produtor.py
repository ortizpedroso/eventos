"""Página pública do produtor/organizador."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.models import Usuario, get_db
from app.routes.auth import get_usuario_atual
from app.services.organizador_publico import garantir_slug_publico, montar_perfil_publico

router = APIRouter()


class PerfilPublicoUpdate(BaseModel):
    bio: str | None = Field(default=None, max_length=2000)
    foto_url: str | None = Field(default=None, max_length=2048)
    social_instagram: str | None = Field(default=None, max_length=500)
    social_whatsapp: str | None = Field(default=None, max_length=500)
    social_site: str | None = Field(default=None, max_length=500)


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
        usuario_atual.foto_url = body.foto_url.strip()[:2048] if body.foto_url else None
    if body.social_instagram is not None:
        usuario_atual.social_instagram = body.social_instagram.strip()[:500] or None
    if body.social_whatsapp is not None:
        usuario_atual.social_whatsapp = body.social_whatsapp.strip()[:500] or None
    if body.social_site is not None:
        usuario_atual.social_site = body.social_site.strip()[:500] or None
    slug = garantir_slug_publico(db, usuario_atual)
    db.refresh(usuario_atual)
    return {"ok": True, "slug_publico": slug}


@router.get("/{slug}")
async def obter_produtor(slug: str, db: Session = Depends(get_db)):
    perfil = montar_perfil_publico(db, slug)
    if not perfil:
        raise HTTPException(status_code=404, detail="Produtor não encontrado")
    return perfil
