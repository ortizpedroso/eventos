"""Tarifas da plataforma EventosBR (taxa de serviço all-in por ingresso)."""

from __future__ import annotations

from dataclasses import dataclass
from typing import TYPE_CHECKING, Literal

if TYPE_CHECKING:
    from app.models import Usuario

PlanoTarifaId = Literal["padrao", "assinatura"]


@dataclass(frozen=True)
class PlanoTarifa:
    id: PlanoTarifaId
    percentual: float
    fixo_por_ingresso: float
    label: str


TARIFA_PADRAO = PlanoTarifa(
    id="padrao",
    percentual=0.10,
    fixo_por_ingresso=2.0,
    label="Por ingresso vendido (sem assinatura)",
)
TARIFA_ASSINATURA = PlanoTarifa(
    id="assinatura",
    percentual=0.08,
    fixo_por_ingresso=1.0,
    label="Com assinatura mensal",
)
MENSALIDADE_ASSINATURA_MENSAL = 500.0

TARIFAS: dict[PlanoTarifaId, PlanoTarifa] = {
    "padrao": TARIFA_PADRAO,
    "assinatura": TARIFA_ASSINATURA,
}


def plano_tarifa_id(usuario: Usuario | None) -> PlanoTarifaId:
    if usuario is None:
        return "padrao"
    raw = (getattr(usuario, "plano_tarifa", None) or "padrao").strip().lower()
    return "assinatura" if raw == "assinatura" else "padrao"


def tarifa_para_organizador(usuario: Usuario | None) -> PlanoTarifa:
    return TARIFAS[plano_tarifa_id(usuario)]


def taxa_ingresso(valor_bruto: float, tarifa: PlanoTarifa | None = None) -> float:
    t = tarifa or TARIFA_PADRAO
    if valor_bruto <= 0:
        return 0.0
    return round(valor_bruto * t.percentual + t.fixo_por_ingresso, 2)


def liquido_organizador(valor_bruto: float, tarifa: PlanoTarifa | None = None) -> float:
    return round(max(0.0, valor_bruto - taxa_ingresso(valor_bruto, tarifa)), 2)


def detalhar_taxa_ingresso(valor_bruto: float, tarifa: PlanoTarifa | None = None) -> dict:
    t = tarifa or TARIFA_PADRAO
    taxa_percentual = round(valor_bruto * t.percentual, 2) if valor_bruto > 0 else 0.0
    taxa_fixa = t.fixo_por_ingresso
    taxa_total = round(taxa_percentual + taxa_fixa, 2)
    return {
        "plano": t.id,
        "preco_ingresso": round(valor_bruto, 2),
        "taxa_percentual": t.percentual,
        "taxa_percentual_valor": taxa_percentual,
        "taxa_fixa": taxa_fixa,
        "taxa_total": taxa_total,
        "liquido_organizador": round(max(0.0, valor_bruto - taxa_total), 2),
        "rotulo_taxa": f"{int(t.percentual * 100)}% + R$ {t.fixo_por_ingresso:.2f}".replace(".", ","),
    }
