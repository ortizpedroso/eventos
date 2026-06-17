"""API de simulação financeira pública."""

from __future__ import annotations

from fastapi import APIRouter, Query

from app.services.taxas_asaas_publicas import (
    AVISO_LEGAL,
    calcular_taxa_asaas,
    comparativo_sympla_ilustrativo,
    simular_parcelas,
)
from app.services.tarifas_plataforma import TARIFA_PADRAO, liquido_organizador, taxa_ingresso

router = APIRouter()


@router.get("/simular")
async def simular_liquido(
    preco: float = Query(..., gt=0, le=500_000),
    metodo: str = Query("pix", pattern="^(pix|boleto|cartao_avista|cartao_parcelado)$"),
    parcelas: int = Query(1, ge=1, le=12),
):
    taxa_plat = taxa_ingresso(preco, TARIFA_PADRAO)
    taxa_asaas = calcular_taxa_asaas(preco, metodo, parcelas=parcelas)  # type: ignore[arg-type]
    liquido = round(max(0.0, preco - taxa_plat - taxa_asaas), 2)
    sympla = comparativo_sympla_ilustrativo(preco)
    parc = simular_parcelas(preco, parcelas) if parcelas > 1 else None
    return {
        "preco_bruto": preco,
        "taxa_eventosbr": round(taxa_plat, 2),
        "taxa_asaas_estimada": taxa_asaas,
        "liquido_organizador": liquido,
        "comparativo_sympla": sympla,
        "parcelamento": parc,
        "aviso_legal": AVISO_LEGAL,
    }
