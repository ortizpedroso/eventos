"""Taxas públicas Asaas (referência jun/2026) — fonte única para simuladores.

Valores conforme https://www.asaas.com/precos-e-taxas — podem variar por conta/promoção.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

AVISO_LEGAL = (
    "Valores estimativos. Taxas de processamento podem variar por conta, antecipação ou promoções. "
    "Não constitui oferta fiscal. Confira nos sites oficiais do gateway."
)

# Comparativo Sympla (ilustrativo — conferir no site oficial)
SYMPLA_TAXA_PERCENTUAL = 0.12
SYMPLA_FONTE_URL = "https://www.sympla.com.br/organizador"


@dataclass(frozen=True)
class TaxaAsaasFixa:
    valor: float
    descricao: str


@dataclass(frozen=True)
class TaxaAsaasPercentual:
    fixo: float
    percentual: float
    descricao: str


TAXA_PIX = TaxaAsaasFixa(1.99, "PIX por transação")
TAXA_BOLETO = TaxaAsaasFixa(1.99, "Boleto por transação")
TAXA_CARTAO_AVISTA = TaxaAsaasPercentual(0.49, 0.0299, "Cartão à vista")
TAXA_CARTAO_2_6X = TaxaAsaasPercentual(0.49, 0.0349, "Cartão 2–6 parcelas")
TAXA_CARTAO_7_12X = TaxaAsaasPercentual(0.49, 0.0399, "Cartão 7–12 parcelas")

PARCELAMENTO_MINIMO_REAIS = 5.0
PARCELAMENTO_MAX_OPCOES = (2, 3, 6, 12)


MetodoAsaas = Literal["pix", "boleto", "cartao_avista", "cartao_parcelado"]


def taxa_cartao_para_parcelas(parcelas: int) -> TaxaAsaasPercentual:
    if parcelas <= 1:
        return TAXA_CARTAO_AVISTA
    if parcelas <= 6:
        return TAXA_CARTAO_2_6X
    return TAXA_CARTAO_7_12X


def calcular_taxa_asaas(
    valor_bruto: float,
    metodo: MetodoAsaas,
    *,
    parcelas: int = 1,
) -> float:
    """Taxa de processamento Asaas estimada (não inclui taxa EventosBR)."""
    if valor_bruto <= 0:
        return 0.0
    if metodo == "pix":
        return TAXA_PIX.valor
    if metodo == "boleto":
        return TAXA_BOLETO.valor
    taxa = taxa_cartao_para_parcelas(parcelas)
    return round(taxa.fixo + valor_bruto * taxa.percentual, 2)


def simular_parcelas(valor_total: float, parcelas: int) -> dict:
    """Retorna valor da parcela e total (sem juros — taxa Asaas separada)."""
    if parcelas < 1 or valor_total <= 0:
        return {"parcelas": 1, "valor_parcela": valor_total, "valor_total": valor_total}
    vp = round(valor_total / parcelas, 2)
    return {
        "parcelas": parcelas,
        "valor_parcela": vp,
        "valor_total": round(vp * parcelas, 2),
        "taxa_asaas_estimada": calcular_taxa_asaas(valor_total, "cartao_parcelado", parcelas=parcelas),
    }


def comparativo_sympla_ilustrativo(valor_bruto: float) -> dict:
    taxa = round(valor_bruto * SYMPLA_TAXA_PERCENTUAL, 2)
    return {
        "taxa_estimada": taxa,
        "liquido_estimado": round(max(0.0, valor_bruto - taxa), 2),
        "percentual": SYMPLA_TAXA_PERCENTUAL,
        "fonte_url": SYMPLA_FONTE_URL,
        "disclaimer": "Comparativo ilustrativo. Valores podem variar — conferir nos sites oficiais.",
    }
