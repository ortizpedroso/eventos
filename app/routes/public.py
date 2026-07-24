"""Rotas públicas (sem autenticação)."""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.models import get_db
from app.schemas.platform_settings import PlatformSettingsPublic
from app.services.platform_settings import get_public_settings

router = APIRouter()


@router.get("/platform", response_model=PlatformSettingsPublic)
async def platform_settings_public(db: Session = Depends(get_db)):
    """Branding da plataforma (logo, cores, contatos, redes)."""
    return get_public_settings(db)
