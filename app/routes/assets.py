"""Upload de imagens (admin e organizador)."""

from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile

from app.deps.platform_admin import require_platform_admin
from app.models import Usuario
from app.routes.auth import get_usuario_atual
from app.services.asset_storage import ALLOWED_IMAGE_TYPES, save_image_upload
from app.services.r2_storage import R2UploadError, upload_imagem_evento

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/admin/assets/upload")
async def upload_asset_admin(
    file: UploadFile = File(...),
    _admin=Depends(require_platform_admin),
):
    content_type = (file.content_type or "").strip().lower()
    if content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(status_code=400, detail="Envie uma imagem (JPEG, PNG, WebP, GIF, SVG ou ICO)")
    data = await file.read()
    try:
        url = save_image_upload(content=data, content_type=content_type, subdir="platform")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    return {"url": url}


@router.post("/organizador/assets/upload")
async def upload_asset_organizador(
    file: UploadFile = File(...),
    usuario_atual: Usuario = Depends(get_usuario_atual),
):
    if usuario_atual.tipo != "organizador":
        raise HTTPException(status_code=403, detail="Apenas organizadores")
    content_type = (file.content_type or "").strip().lower()
    if content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(status_code=400, detail="Envie uma imagem (JPEG, PNG, WebP, GIF ou SVG)")
    data = await file.read()
    try:
        url = save_image_upload(content=data, content_type=content_type, subdir=f"org/{usuario_atual.id[:8]}")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    return {"url": url}


@router.post("/organizador/eventos/upload-imagem")
async def upload_imagem_evento_route(
    file: UploadFile = File(...),
    usuario_atual: Usuario = Depends(get_usuario_atual),
):
    """Upload de imagem de capa de evento. Tenta R2 primeiro (host único, habilita next/image);

    cai para o storage local em disco (mesmo mecanismo de logo/perfil) se o R2 não estiver
    configurado ou falhar — nunca bloqueia o organizador por causa de uma dependência externa.
    """
    if usuario_atual.tipo != "organizador":
        raise HTTPException(status_code=403, detail="Apenas organizadores")
    content_type = (file.content_type or "").strip().lower()
    data = await file.read()

    try:
        url = upload_imagem_evento(data, content_type)
        return {"url": url}
    except R2UploadError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except RuntimeError as e:
        logger.info("Upload de imagem de evento: R2 indisponível/não configurado (%s), usando disco local.", e)

    if content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(status_code=400, detail="Envie uma imagem (JPEG, PNG, WebP ou GIF)")
    try:
        url = save_image_upload(content=data, content_type=content_type, subdir=f"eventos/{usuario_atual.id[:8]}")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    return {"url": url}
