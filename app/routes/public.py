"""Rotas públicas (sem autenticação)."""

import os

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.models import get_db
from app.schemas.platform_settings import PlatformSettingsPublic
from app.services.organizador_publico import resolver_tenant_por_subdomain
from app.services.platform_settings import get_public_settings

router = APIRouter()

# Marcadores estáveis — scripts de deploy comparam estes flags.
DEPLOY_FEATURES = {
    "asset_upload": True,
    "email_branding": True,
    "organizer_brand": True,
    "platform_settings": True,
}


@router.get("/version")
async def deploy_version():
    """Versão em produção (commit + funcionalidades) — usado pelos scripts de deploy."""
    return {
        "git_commit": (os.getenv("GIT_COMMIT") or "unknown").strip(),
        "features": DEPLOY_FEATURES,
    }


@router.get("/platform", response_model=PlatformSettingsPublic)
async def platform_settings_public(db: Session = Depends(get_db)):
    """Branding da plataforma (logo, cores, contatos, redes)."""
    return get_public_settings(db)


@router.get("/tenant")
async def tenant_por_subdomain(
    subdomain: str = Query(..., min_length=1, max_length=63),
    db: Session = Depends(get_db),
):
    """Resolve organizador pelo subdomínio (white-label)."""
    tenant = resolver_tenant_por_subdomain(db, subdomain)
    if not tenant:
        raise HTTPException(status_code=404, detail="Organizador não encontrado")
    return tenant
