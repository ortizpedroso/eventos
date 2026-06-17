"""Encontra ou cria usuário a partir de login social (Google)."""

from __future__ import annotations

import logging
from datetime import datetime, timezone

from fastapi import HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models import Usuario
from app.services.usuario_pagamentos import criar_pagamento_para_novo_usuario
logger = logging.getLogger(__name__)

_PROVIDER_LABEL = {"google": "Google", "apple": "Apple"}


def _normalizar_tipo(tipo: str) -> str:
    s = (tipo or "cliente").strip().lower()
    if s in ("cliente", "organizador"):
        return s
    raise HTTPException(status_code=400, detail='tipo deve ser "cliente" ou "organizador"')


def obter_ou_criar_usuario_oauth(
    db: Session,
    *,
    provider: str,
    provider_id: str,
    email: str,
    nome: str,
    tipo: str = "cliente",
    aceita_comunicacao_email: bool = False,
    aceita_comunicacao_whatsapp: bool = False,
    telefone: str | None = None,
) -> Usuario:
    email_norm = email.strip().lower()
    nome_limpo = (nome or email_norm.split("@")[0]).strip() or "Usuário"
    provider_id = provider_id.strip()
    if not provider_id:
        raise HTTPException(status_code=400, detail="Identificador do provedor inválido.")

    por_provedor = (
        db.query(Usuario)
        .filter(Usuario.auth_provider == provider, Usuario.auth_provider_id == provider_id)
        .first()
    )
    if por_provedor:
        if not por_provedor.ativo:
            raise HTTPException(status_code=403, detail="Conta desativada.")
        return por_provedor

    existente_email = (
        db.query(Usuario).filter(func.lower(Usuario.email) == email_norm).first()
    )
    if existente_email:
        if not existente_email.ativo:
            raise HTTPException(status_code=403, detail="Conta desativada.")
        if existente_email.auth_provider == provider:
            if not existente_email.auth_provider_id:
                existente_email.auth_provider_id = provider_id
                db.commit()
                db.refresh(existente_email)
            elif existente_email.auth_provider_id != provider_id:
                raise HTTPException(status_code=400, detail="Conta social já vinculada a outro perfil.")
            return existente_email
        if existente_email.auth_provider == "email" and existente_email.senha_hash:
            raise HTTPException(
                status_code=409,
                detail=(
                    "Este email já tem conta com senha. Entre com email e senha, "
                    "ou vincule o Google em Perfil informando a senha atual."
                ),
            )
        label = _PROVIDER_LABEL.get(existente_email.auth_provider, existente_email.auth_provider)
        raise HTTPException(
            status_code=400,
            detail=f"Este email já está cadastrado. Entre com {label}.",
        )

    tipo_norm = _normalizar_tipo(tipo)
    if aceita_comunicacao_whatsapp and not telefone:
        raise HTTPException(
            status_code=400,
            detail="Para WhatsApp, informe telefone no cadastro ou ative depois no perfil.",
        )

    try:
        prov = criar_pagamento_para_novo_usuario(
            email=email_norm,
            nome=nome_limpo,
            tipo=tipo_norm,
            telefone=telefone,
        )
    except Exception as e:
        logger.exception("Provedor pagamento no cadastro OAuth: %s", e)
        from app.utils.public_errors import PAGAMENTO_CLIENTE

        raise HTTPException(status_code=400, detail=PAGAMENTO_CLIENTE) from e

    novo = Usuario(
        email=email_norm,
        nome=nome_limpo,
        senha_hash=None,
        auth_provider=provider,
        auth_provider_id=provider_id,
        tipo=tipo_norm,
        email_verificado=True,
        asaas_customer_id=prov.get("asaas_customer_id"),
        asaas_wallet_id=prov.get("asaas_wallet_id"),
        asaas_account_id=prov.get("asaas_account_id"),
        aceita_comunicacao_email=aceita_comunicacao_email,
        aceita_comunicacao_whatsapp=aceita_comunicacao_whatsapp,
        telefone=telefone,
    )
    if aceita_comunicacao_email or aceita_comunicacao_whatsapp:
        novo.comunicacao_consentimento_em = datetime.now(timezone.utc).replace(tzinfo=None)

    db.add(novo)
    db.commit()
    db.refresh(novo)
    logger.info("Usuário OAuth %s criado: %s (%s)", provider, novo.id, email_norm)
    return novo
