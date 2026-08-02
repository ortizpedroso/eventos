"""Self-service: comprador vincula ingresso à conta logada via código da carteirinha."""

from __future__ import annotations

import logging

from sqlalchemy.orm import Session

from app.models import Ingresso, Usuario
from app.services.ingresso_checkin import extrair_ingresso_id

logger = logging.getLogger(__name__)

_STATUS_VINCULABLE = frozenset({"pago", "usado"})


def vincular_ingresso_a_conta(
    db: Session,
    *,
    usuario: Usuario,
    codigo: str,
) -> tuple[Ingresso, bool]:
    """Reassocia ingresso confirmado à conta logada quando o e-mail coincide com o da compra.

    Retorna (ingresso, já_estava_vinculado).
    """
    ingresso_id = extrair_ingresso_id(codigo)
    if not ingresso_id:
        raise ValueError(
            "Código inválido. Copie o código completo da carteirinha ou do e-mail do ingresso."
        )

    ingresso = db.get(Ingresso, ingresso_id)
    if ingresso is None:
        raise ValueError("Ingresso não encontrado para este código.")

    status = (ingresso.status or "").lower()
    if status not in _STATUS_VINCULABLE:
        raise ValueError("Só ingressos confirmados (pagos ou já utilizados) podem ser vinculados.")

    email_conta = (usuario.email or "").strip().lower()
    email_participante = (ingresso.participante_email or "").strip().lower()
    if not email_conta or email_conta != email_participante:
        raise ValueError(
            "O e-mail da sua conta deve ser o mesmo usado na compra. "
            "Se o organizador digitou outro e-mail, peça a correção na bilheteria do evento."
        )

    if ingresso.usuario_id == usuario.id:
        return ingresso, True

    usuario_anterior_id = ingresso.usuario_id
    ingresso.usuario_id = usuario.id
    db.commit()
    db.refresh(ingresso)

    logger.info(
        "Ingresso %s vinculado à conta %s (antes usuario %s) via self-service",
        ingresso.id,
        usuario.id,
        usuario_anterior_id,
    )
    return ingresso, False
