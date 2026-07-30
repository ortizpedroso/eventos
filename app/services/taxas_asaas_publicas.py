"""Referência interna Asaas — https://www.asaas.com/precos-e-taxas

Tabela pública conferida em jul/2026:
  Pix / boleto: R$ 1,99
  Cartão crédito: R$ 0,49 + 2,99% (à vista) / 3,49% (2–6x) / 3,99% (7–12x) / 4,29% (13–21x)
  Antecipação: 1,25% a.m. à vista / 1,70% a.m. parcelado
  Pix saída PJ: 30 grátis/mês, depois R$ 2,00

Acréscimo ao comprador no parcelamento = custo extra vs cartão à vista com antecipação:
  1) delta % de processamento (ex.: 12x 3,99% − 2,99% = +1 pp)
  2) custo de antecipação do parcelado (1,70% a.m. × meses médios) embutido no total
Assim organizador (split) e margem líquida da plataforma ficam equivalentes ao à vista.
Opções de checkout: 2, 3, 6 e 12x (máx. 12 no produto).

Usado para acréscimo de parcelamento ao comprador e margem interna da plataforma.
Não expor marca ou linhas Asaas na UI pública.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

AVISO_LEGAL = (
    "Valores conforme tabelas públicas de processamento. "
    "A taxa EventosBR é fixa por plano; parcelamento inclui acréscimo ao comprador "
    "(processamento e antecipação do parcelado)."
)

SYMPLA_TAXA_PERCENTUAL = 0.12
SYMPLA_FONTE_URL = "https://www.sympla.com.br/organizador"

INGRESSO_MINIMO_PAGO_REAIS = 10.0
PARCELAMENTO_MINIMO_REAIS = INGRESSO_MINIMO_PAGO_REAIS
PARCELAMENTO_MAX_OPCOES = (2, 3, 6, 12)

TAXA_ANTECIPACAO_AVISTA_MES = 0.0125
TAXA_ANTECIPACAO_PARCELADO_MES = 0.0170
TAXA_SAQUE_PIX_PJ = 2.0
TRANSFERENCIAS_PIX_GRATIS_MES_PJ = 30


@dataclass(frozen=True)
class TaxaAsaasPercentual:
    fixo: float
    percentual: float
    descricao: str


TAXA_PIX = 1.99
TAXA_BOLETO = 1.99
TAXA_CARTAO_AVISTA = TaxaAsaasPercentual(0.49, 0.0299, "Cartão à vista")
TAXA_CARTAO_2_6X = TaxaAsaasPercentual(0.49, 0.0349, "Cartão 2–6 parcelas")
TAXA_CARTAO_7_12X = TaxaAsaasPercentual(0.49, 0.0399, "Cartão 7–12 parcelas")
TAXA_CARTAO_13_21X = TaxaAsaasPercentual(0.49, 0.0429, "Cartão 13–21 parcelas")

MetodoAsaas = Literal["pix", "boleto", "cartao_avista", "cartao_parcelado"]


def taxa_cartao_para_parcelas(parcelas: int) -> TaxaAsaasPercentual:
    if parcelas <= 1:
        return TAXA_CARTAO_AVISTA
    if parcelas <= 6:
        return TAXA_CARTAO_2_6X
    if parcelas <= 12:
        return TAXA_CARTAO_7_12X
    return TAXA_CARTAO_13_21X


def calcular_taxa_asaas(
    valor_bruto: float,
    metodo: MetodoAsaas,
    *,
    parcelas: int = 1,
) -> float:
    """Custo interno de processamento (não exibido ao usuário final)."""
    if valor_bruto <= 0:
        return 0.0
    if metodo == "pix":
        return TAXA_PIX
    if metodo == "boleto":
        return TAXA_BOLETO
    taxa = taxa_cartao_para_parcelas(parcelas)
    return round(taxa.fixo + valor_bruto * taxa.percentual, 2)


def meses_medios_antecipacao_parcelado(parcelas: int) -> float:
    """Média dos prazos das parcelas (1…N) — base para 1,70% a.m. no parcelado."""
    n = max(1, int(parcelas))
    return (n + 1) / 2.0


def calcular_custo_antecipacao_cartao(valor_bruto: float, parcelas: int) -> float:
    """Estimativa da taxa de antecipação Asaas sobre o líquido após processamento."""
    if valor_bruto <= 0:
        return 0.0
    metodo: MetodoAsaas = "cartao_avista" if parcelas <= 1 else "cartao_parcelado"
    processamento = calcular_taxa_asaas(valor_bruto, metodo, parcelas=max(1, parcelas))
    base = max(0.0, valor_bruto - processamento)
    if parcelas <= 1:
        return round(base * TAXA_ANTECIPACAO_AVISTA_MES, 2)
    return round(base * TAXA_ANTECIPACAO_PARCELADO_MES * meses_medios_antecipacao_parcelado(parcelas), 2)


def liquido_apos_processamento_e_antecipacao(valor_bruto: float, parcelas: int) -> float:
    """Valor que sobra na cobrança após taxas Asaas de cartão + antecipação."""
    if valor_bruto <= 0:
        return 0.0
    metodo: MetodoAsaas = "cartao_avista" if parcelas <= 1 else "cartao_parcelado"
    processamento = calcular_taxa_asaas(valor_bruto, metodo, parcelas=max(1, parcelas))
    antecipacao = calcular_custo_antecipacao_cartao(valor_bruto, parcelas)
    return round(max(0.0, valor_bruto - processamento - antecipacao), 2)


def calcular_acrescimo_parcelamento_comprador(valor_base: float, parcelas: int) -> float:
    """Acréscimo ao comprador para equalizar margem vs cartão à vista com antecipação.

    Inclui o delta de processamento do parcelado e o custo de antecipação (1,70% a.m.),
    de modo que organizador (split) e plataforma não sejam prejudicados pelo parcelamento.
    """
    if parcelas <= 1 or valor_base <= 0:
        return 0.0

    alvo_liquido = liquido_apos_processamento_e_antecipacao(valor_base, 1)
    # Busca o menor total cobrado tal que o líquido após Asaas+antecipação >= alvo à vista.
    lo = round(valor_base, 2)
    hi = round(valor_base * 1.8 + 20.0, 2)
    for _ in range(48):
        mid = round((lo + hi) / 2.0, 2)
        if liquido_apos_processamento_e_antecipacao(mid, parcelas) >= alvo_liquido:
            hi = mid
        else:
            lo = round(mid + 0.01, 2)
    total = hi
    while liquido_apos_processamento_e_antecipacao(total, parcelas) < alvo_liquido:
        total = round(total + 0.01, 2)
    return round(max(0.0, total - valor_base), 2)


RepasseParcelamento = Literal["comprador", "organizador"]


def cotacao_checkout(
    valor_base: float,
    *,
    parcelas: int = 1,
    repasse_parcelamento: RepasseParcelamento = "comprador",
) -> dict:
    """Breakdown público para checkout (sem expor Asaas)."""
    acrescimo_bruto = calcular_acrescimo_parcelamento_comprador(valor_base, parcelas)
    repasse = repasse_parcelamento if repasse_parcelamento in ("comprador", "organizador") else "comprador"
    acrescimo_comprador = 0.0 if repasse == "organizador" else acrescimo_bruto
    total = round(valor_base + acrescimo_comprador, 2)
    valor_parcela = round(total / parcelas, 2) if parcelas > 1 else total
    return {
        "preco_ingresso": round(valor_base, 2),
        "parcelas": parcelas,
        "acrescimo_parcelamento": acrescimo_comprador,
        "acrescimo_bruto": acrescimo_bruto,
        "repasse_parcelamento": repasse,
        "total_pagar": total,
        "valor_parcela": valor_parcela if parcelas > 1 else None,
        "faixa_parcelamento": taxa_cartao_para_parcelas(parcelas).descricao if parcelas > 1 else None,
    }


def simular_parcelas(valor_total: float, parcelas: int) -> dict:
    """Parcelas com acréscimo explícito ao comprador."""
    if parcelas < 1 or valor_total <= 0:
        return {
            "parcelas": 1,
            "valor_parcela": valor_total,
            "valor_total": valor_total,
            "acrescimo_parcelamento": 0.0,
        }
    cot = cotacao_checkout(valor_total, parcelas=parcelas)
    return {
        "parcelas": parcelas,
        "valor_parcela": cot["valor_parcela"],
        "valor_total": cot["total_pagar"],
        "acrescimo_parcelamento": cot["acrescimo_parcelamento"],
        "preco_ingresso": cot["preco_ingresso"],
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
