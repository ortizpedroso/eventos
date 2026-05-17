"""Métricas operacionais por evento (vagas, conversão)."""

from __future__ import annotations

from sqlalchemy.orm import Session

from app.models import Evento
from app.services.ingresso_lotes import contar_ocupacao_por_lotes


def vagas_restantes_evento(db: Session, evento: Evento) -> int | None:
    """Soma vagas restantes em lotes ativos com limite. None = sem limite global."""
    lotes = [l for l in evento.ingresso_lotes if l.ativo and l.quantidade_maxima is not None]
    if not lotes:
        return None
    ocp = contar_ocupacao_por_lotes(db, [l.id for l in lotes])
    return sum(max(0, int(l.quantidade_maxima) - ocp.get(l.id, 0)) for l in lotes)


def taxa_conversao_por_status(por_status: dict[str, int]) -> float | None:
    total = sum(int(v) for v in por_status.values())
    pagos = int(por_status.get("pago", 0)) + int(por_status.get("usado", 0))
    if total <= 0:
        return None
    return round((pagos / total) * 100.0, 1)
