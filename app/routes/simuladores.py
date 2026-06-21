"""API de simulação financeira pública."""

from __future__ import annotations

from fastapi import APIRouter, Query

from app.services.taxas_asaas_publicas import (
    AVISO_LEGAL,
    comparativo_sympla_ilustrativo,
    cotacao_checkout,
    simular_parcelas,
)
from app.services.tarifas_plataforma import TARIFA_PADRAO, detalhar_taxa_ingresso

router = APIRouter()


@router.get("/simular")
async def simular_liquido(
    preco: float = Query(..., gt=0, le=500_000),
    parcelas: int = Query(1, ge=1, le=21),
    plano: str = Query("padrao", pattern="^(padrao|assinatura)$"),
):
    """Simulador organizador: taxa EventosBR fixa; parcelamento com acréscimo ao comprador."""
    from app.services.tarifas_plataforma import TARIFAS

    tarifa = TARIFAS.get(plano, TARIFA_PADRAO)  # type: ignore[arg-type]
    det = detalhar_taxa_ingresso(preco, tarifa)
    parc = simular_parcelas(preco, parcelas) if parcelas > 1 else None
    sympla = comparativo_sympla_ilustrativo(preco)
    return {
        "preco_ingresso": det["preco_ingresso"],
        "plano": det["plano"],
        "rotulo_taxa": det["rotulo_taxa"],
        "taxa_eventosbr": det["taxa_total"],
        "liquido_organizador": det["liquido_organizador"],
        "parcelamento": parc,
        "comprador": cotacao_checkout(preco, parcelas=parcelas) if parcelas > 1 else None,
        "comparativo_sympla": sympla,
        "aviso_legal": AVISO_LEGAL,
    }
