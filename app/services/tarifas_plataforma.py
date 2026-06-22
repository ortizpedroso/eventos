"""Tarifas da plataforma EventosBR (taxa de serviço all-in por ingresso)."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
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
    if raw == "assinatura":
        valida_ate = getattr(usuario, "assinatura_valida_ate", None)
        if valida_ate is not None:
            agora = datetime.now(timezone.utc).replace(tzinfo=None)
            if valida_ate >= agora:
                return "assinatura"
        return "padrao"
    return "padrao"


def tarifa_para_organizador(usuario: Usuario | None) -> PlanoTarifa:
    return TARIFAS[plano_tarifa_id(usuario)]


def taxa_ingresso(valor_bruto: float, tarifa: PlanoTarifa | None = None) -> float:
    t = tarifa or TARIFA_PADRAO
    if valor_bruto <= 0:
        return 0.0
    return round(valor_bruto * t.percentual + t.fixo_por_ingresso, 2)


def liquido_organizador(valor_bruto: float, tarifa: PlanoTarifa | None = None) -> float:
    return round(max(0.0, valor_bruto - taxa_ingresso(valor_bruto, tarifa)), 2)


def ledger_ingresso_venda(
    valor_unit: float,
    *,
    tarifa: PlanoTarifa,
    desconto_parcelamento_total: float = 0.0,
    quantidade_lote: int = 1,
    parcelas: int | None = None,
) -> dict:
    """Valores por ingresso gravados no ledger (espelham o split Asaas)."""
    q = max(1, int(quantidade_lote or 1))
    desconto_unit = round(max(0.0, float(desconto_parcelamento_total or 0)) / q, 2)
    det = detalhar_taxa_ingresso(valor_unit, tarifa)
    liquido = round(max(0.0, float(det["liquido_organizador"]) - desconto_unit), 2)
    return {
        "liquido_repassado": liquido,
        "taxa_plataforma_aplicada": float(det["taxa_total"]),
        "desconto_parcelamento_organizador": desconto_unit,
        "parcelas_cobranca": parcelas,
        "plano_tarifa_venda": tarifa.id,
    }


def liquido_ingresso_para_saldo(ingresso, tarifa_fallback: PlanoTarifa | None = None) -> float:
    """Usa ledger persistido; fallback para ingressos antigos."""
    stored = getattr(ingresso, "liquido_repassado", None)
    if stored is not None:
        return round(float(stored), 2)
    valor = float(getattr(ingresso, "valor", 0) or 0)
    plano = (getattr(ingresso, "plano_tarifa_venda", None) or "").strip().lower()
    tarifa = TARIFAS.get(plano) if plano in TARIFAS else (tarifa_fallback or TARIFA_PADRAO)  # type: ignore[arg-type]
    desconto = float(getattr(ingresso, "desconto_parcelamento_organizador", 0) or 0)
    return round(max(0.0, liquido_organizador(valor, tarifa) - desconto), 2)


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
