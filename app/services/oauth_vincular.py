"""Vincula login Google a conta existente com senha (exige senha atual)."""

from __future__ import annotations

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models import Usuario
from app.services.auth import verify_password


def vincular_google_a_conta_email(
    db: Session,
    usuario: Usuario,
    *,
    provider_id: str,
    senha_atual: str,
    nome: str | None = None,
) -> Usuario:
    if usuario.auth_provider == "google" and usuario.auth_provider_id:
        if usuario.auth_provider_id == provider_id:
            return usuario
        raise HTTPException(status_code=400, detail="Conta já vinculada a outro perfil Google.")

    if not usuario.senha_hash:
        raise HTTPException(
            status_code=400,
            detail="Conta sem senha local. Use o login social já configurado.",
        )
    if not verify_password(senha_atual, usuario.senha_hash):
        raise HTTPException(status_code=400, detail="Senha atual incorreta.")

    existente = (
        db.query(Usuario)
        .filter(Usuario.auth_provider == "google", Usuario.auth_provider_id == provider_id)
        .first()
    )
    if existente and existente.id != usuario.id:
        raise HTTPException(status_code=400, detail="Este Google já está vinculado a outra conta.")

    usuario.auth_provider = "google"
    usuario.auth_provider_id = provider_id.strip()
    if nome and nome.strip():
        usuario.nome = nome.strip()
    db.commit()
    db.refresh(usuario)
    return usuario
