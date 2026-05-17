"""Tarifas da plataforma (espelho da lógica do frontend /planos)."""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class PlanoTarifa:
    percentual: float
    fixo_por_ingresso: float


TARIFA_PADRAO = PlanoTarifa(percentual=0.10, fixo_por_ingresso=2.0)
MENSALIDADE_ASSINATURA_MENSAL = 500.0


def taxa_ingresso(valor_bruto: float, tarifa: PlanoTarifa = TARIFA_PADRAO) -> float:
    if valor_bruto <= 0:
        return 0.0
    return valor_bruto * tarifa.percentual + tarifa.fixo_por_ingresso


def liquido_organizador(valor_bruto: float, tarifa: PlanoTarifa = TARIFA_PADRAO) -> float:
    return max(0.0, valor_bruto - taxa_ingresso(valor_bruto, tarifa))
