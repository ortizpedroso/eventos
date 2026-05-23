"""Limite de ingressos por CPF em um evento."""

from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.models import Evento, Ingresso
from app.utils.cpf import normalizar_cpf


def _agora() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def cpf_ingressos_ativos_no_evento(db: Session, evento_id: str, cpf_digits: str) -> int:
    """Conta ingressos ativos para um CPF, excluindo reservas já expiradas."""
    cpf = normalizar_cpf(cpf_digits)
    if not cpf:
        return 0
    agora = _agora()
    return (
        db.query(Ingresso)
        .filter(
            Ingresso.evento_id == evento_id,
            Ingresso.participante_cpf == cpf,
            Ingresso.status.in_(("pendente", "pago", "usado")),
            or_(
                Ingresso.status.in_(("pago", "usado")),  # confirmados sempre contam
                Ingresso.reservado_ate.is_(None),         # sem prazo = conta (legado)
                Ingresso.reservado_ate > agora,           # prazo ainda válido = conta
            ),
        )
        .count()
    )


def validar_limite_cpf_evento(
    db: Session,
    evento: Evento,
    cpf_digits: str,
    *,
    incremento: int = 1,
) -> None:
    limite = getattr(evento, "limite_ingressos_por_cpf", None)
    if limite is None or limite < 1:
        return
    atual = cpf_ingressos_ativos_no_evento(db, evento.id, cpf_digits)
    if atual + incremento > limite:
        raise ValueError(
            f"Limite de {limite} ingresso(s) por CPF neste evento. "
            f"Este CPF já possui {atual} ingresso(s) ativo(s)."
        )
