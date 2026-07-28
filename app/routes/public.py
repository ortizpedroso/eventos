"""Rotas públicas (sem autenticação)."""

import logging
import os

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy.orm import Session

from app.deps.rate_limit import enforce_rate_limit
from app.models import get_db
from app.schemas.platform_settings import PlatformSettingsPublic
from app.services.organizador_publico import resolver_tenant_por_subdomain
from app.services.platform_settings import get_public_settings
from app.services.turnstile import verificar_turnstile

logger = logging.getLogger(__name__)

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


class ContatoRequest(BaseModel):
    nome: str = Field(min_length=1, max_length=200)
    email: EmailStr
    assunto: str = Field(min_length=1, max_length=200)
    mensagem: str = Field(min_length=10, max_length=5000)
    turnstile_token: str | None = None


@router.post("/contato")
async def enviar_contato(
    body: ContatoRequest,
    request: Request,
    db: Session = Depends(get_db),
):
    """Formulário público 'Fale conosco' — encaminha para o e-mail de contato da plataforma."""
    enforce_rate_limit(request, "contato_publico")

    if not await verificar_turnstile(body.turnstile_token, request.client.host if request.client else None):
        raise HTTPException(
            status_code=400,
            detail="Não foi possível confirmar que você não é um robô. Recarregue a página e tente de novo.",
        )

    from app.models.contato_site_mensagem import ContatoSiteMensagem
    from app.services.smtp_client import send_email, smtp_configured

    registro = ContatoSiteMensagem(
        nome=body.nome.strip(),
        email=str(body.email).strip(),
        assunto=body.assunto.strip(),
        mensagem=body.mensagem.strip(),
        email_enviado=False,
    )
    db.add(registro)
    db.commit()
    db.refresh(registro)

    settings_pub = get_public_settings(db)
    destino = settings_pub.contact_email or settings_pub.support_email
    email_ok = False
    if destino and smtp_configured():
        corpo = (
            f"Nova mensagem pelo formulário de contato do site.\n\n"
            f"Nome: {body.nome}\n"
            f"E-mail: {body.email}\n"
            f"Assunto: {body.assunto}\n\n"
            f"Mensagem:\n{body.mensagem}\n"
        )
        email_ok = send_email(
            destino=destino,
            assunto=f"[Contato site] {body.assunto}",
            corpo_texto=corpo,
            reply_to=str(body.email),
            db=db,
        )
        if email_ok:
            registro.email_enviado = True
            db.commit()
        else:
            logger.warning(
                "Contato público salvo (id=%s) mas falha SMTP para %s",
                registro.id,
                destino,
            )
    else:
        logger.warning(
            "Contato público salvo (id=%s) mas sem destino/SMTP configurado (destino=%s)",
            registro.id,
            destino,
        )

    return {"message": "Mensagem enviada com sucesso. Responderemos em breve."}
