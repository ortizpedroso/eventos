"""Upload de imagens (admin e organizador)."""

from __future__ import annotations

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile

from app.deps.platform_admin import require_platform_admin
from app.models import Usuario
from app.routes.auth import get_usuario_atual
from app.services.asset_storage import ALLOWED_IMAGE_TYPES, save_image_upload

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
