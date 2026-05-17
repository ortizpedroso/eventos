"""Ações ao confirmar pagamento de um ingresso."""

from __future__ import annotations

from sqlalchemy.orm import Session

from app.models import Ingresso
from app.services.cupom_desconto import registrar_uso_cupom
from app.services.ticket_email import enqueue_ticket_email


def marcar_ingresso_pago(db: Session, ingresso: Ingresso) -> bool:
    """Marca como pago (sem commit). Retorna True se mudou de status."""
    if ingresso.status == "pago":
        return False
    ingresso.status = "pago"
    registrar_uso_cupom(db, getattr(ingresso, "cupom_id", None))
    return True


def notificar_ingresso_pago(ingresso_id: str) -> None:
    """Dispara e-mail do ingresso (após commit)."""
    enqueue_ticket_email(ingresso_id)
