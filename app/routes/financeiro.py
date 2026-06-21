"""Financeiro white-label do organizador: saldo, extrato e saques."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.models import Usuario, get_db
from app.routes.auth import get_usuario_atual
from app.services.financeiro_organizador import (
    calcular_saldo_organizador,
    cancelar_saque,
    listar_extrato,
    solicitar_saque,
)

router = APIRouter()


def _require_organizador(usuario: Usuario) -> None:
    if usuario.tipo != "organizador":
        raise HTTPException(status_code=403, detail="Apenas organizadores acessam o financeiro.")


class SaqueRequest(BaseModel):
    valor: float = Field(gt=0, le=1_000_000)
    pix_chave: str = Field(min_length=5, max_length=120)
    pix_tipo: str = Field(default="EVP", max_length=20)


@router.get("/saldo")
async def financeiro_saldo(
    usuario_atual: Usuario = Depends(get_usuario_atual),
    db: Session = Depends(get_db),
):
    _require_organizador(usuario_atual)
    return calcular_saldo_organizador(db, usuario_atual)


@router.get("/extrato")
async def financeiro_extrato(
    usuario_atual: Usuario = Depends(get_usuario_atual),
    db: Session = Depends(get_db),
    limite: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
):
    _require_organizador(usuario_atual)
    return listar_extrato(db, usuario_atual, limite=limite, offset=offset)


@router.post("/saque")
async def financeiro_solicitar_saque(
    body: SaqueRequest,
    usuario_atual: Usuario = Depends(get_usuario_atual),
    db: Session = Depends(get_db),
):
    _require_organizador(usuario_atual)
    try:
        saque = solicitar_saque(
            db,
            usuario_atual,
            valor=body.valor,
            pix_chave=body.pix_chave,
            pix_tipo=body.pix_tipo,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    return {
        "ok": True,
        "id": saque.id,
        "valor": float(saque.valor),
        "status": saque.status,
        "mensagem": "Solicitação de saque registrada. O valor será transferido via Pix após análise.",
    }


@router.post("/saque/{saque_id}/cancelar")
async def financeiro_cancelar_saque(
    saque_id: str,
    usuario_atual: Usuario = Depends(get_usuario_atual),
    db: Session = Depends(get_db),
):
    _require_organizador(usuario_atual)
    try:
        saque = cancelar_saque(db, usuario_atual, saque_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    return {
        "ok": True,
        "id": saque.id,
        "status": saque.status,
        "mensagem": "Solicitação de saque cancelada. O saldo voltou a ficar disponível.",
    }
