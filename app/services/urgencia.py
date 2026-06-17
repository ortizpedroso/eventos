"""Badge de urgência / escassez configurável por evento."""

from __future__ import annotations

from dataclasses import dataclass

# Thresholds para modo "faixa"
FAIXA_MENOS_DE = 10
FAIXA_ULTIMOS = 20


@dataclass(frozen=True)
class UrgenciaBadge:
    ativo: bool
    texto: str | None
    restantes: int | None = None


def calcular_urgencia(
    modo: str,
    *,
    restantes: int | None,
) -> UrgenciaBadge:
    modo = (modo or "desligado").strip().lower()
    if modo == "desligado" or restantes is None or restantes <= 0:
        return UrgenciaBadge(ativo=False, texto=None, restantes=restantes)

    if modo == "exato":
        return UrgenciaBadge(
            ativo=True,
            texto=f"Restam {restantes} ingresso{'s' if restantes != 1 else ''}",
            restantes=restantes,
        )

    if modo == "faixa":
        if restantes < FAIXA_MENOS_DE:
            return UrgenciaBadge(ativo=True, texto="Menos de 10 ingressos", restantes=restantes)
        if restantes <= FAIXA_ULTIMOS:
            return UrgenciaBadge(ativo=True, texto="Últimos ingressos", restantes=restantes)
        return UrgenciaBadge(ativo=False, texto=None, restantes=restantes)

    return UrgenciaBadge(ativo=False, texto=None, restantes=restantes)
