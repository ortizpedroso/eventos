"""Financeiro white-label do organizador: saldo, extrato, saques e relatórios."""

from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.deps.rate_limit import rate_limit_financeiro_saque
from app.models import Usuario, get_db
from app.routes.auth import get_usuario_atual
from app.services.financeiro_conciliacao import conciliar_financeiro_organizador
from app.services.financeiro_organizador import (
    calcular_saldo_organizador,
    cancelar_saque,
    listar_extrato,
    listar_saques,
    listar_vendas_agrupadas,
    obter_comprovante_saque,
    solicitar_saque,
)

router = APIRouter()


def _require_organizador(usuario: Usuario) -> None:
    if usuario.tipo != "organizador":
        raise HTTPException(status_code=403, detail="Apenas organizadores acessam o financeiro.")


def _parse_data_opcional(valor: str | None) -> datetime | None:
    if not valor:
        return None
    try:
        return datetime.fromisoformat(valor.replace("Z", "+00:00")).replace(tzinfo=None)
    except ValueError as e:
        raise HTTPException(status_code=400, detail="Data inválida. Use ISO 8601.") from e


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


@router.get("/vendas")
async def financeiro_vendas(
    usuario_atual: Usuario = Depends(get_usuario_atual),
    db: Session = Depends(get_db),
    agrupamento: str = Query("mes", pattern="^(dia|semana|mes|ano|evento)$"),
    de: str | None = Query(None),
    ate: str | None = Query(None),
):
    _require_organizador(usuario_atual)
    return listar_vendas_agrupadas(
        db,
        usuario_atual,
        agrupamento=agrupamento,  # type: ignore[arg-type]
        de=_parse_data_opcional(de),
        ate=_parse_data_opcional(ate),
    )


@router.get("/saques")
async def financeiro_listar_saques(
    usuario_atual: Usuario = Depends(get_usuario_atual),
    db: Session = Depends(get_db),
    limite: int = Query(50, ge=1, le=200),
):
    _require_organizador(usuario_atual)
    return {"saques": listar_saques(db, usuario_atual, limite=limite)}


@router.get("/conciliacao")
async def financeiro_conciliacao(
    usuario_atual: Usuario = Depends(get_usuario_atual),
    db: Session = Depends(get_db),
):
    _require_organizador(usuario_atual)
    return conciliar_financeiro_organizador(db, usuario_atual)


@router.get("/saque/{saque_id}/comprovante")
async def financeiro_comprovante_saque(
    saque_id: str,
    usuario_atual: Usuario = Depends(get_usuario_atual),
    db: Session = Depends(get_db),
):
    _require_organizador(usuario_atual)
    try:
        return obter_comprovante_saque(db, usuario_atual, saque_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e


@router.post("/saque")
async def financeiro_solicitar_saque(
    request: Request,
    body: SaqueRequest,
    usuario_atual: Usuario = Depends(get_usuario_atual),
    db: Session = Depends(get_db),
    _rl: None = Depends(rate_limit_financeiro_saque),
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
    prazo = calcular_saldo_organizador(db, usuario_atual).get("prazo_transferencia_horas", 48)
    return {
        "ok": True,
        "id": saque.id,
        "valor": float(saque.valor),
        "status": saque.status,
        "previsao_liquidacao_em": (
            saque.previsao_liquidacao_em.isoformat() if saque.previsao_liquidacao_em else None
        ),
        "mensagem": (
            f"Transferência solicitada. A efetivação ocorre em até {prazo}h na chave Pix informada."
        ),
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
