"""Ações ao confirmar pagamento de um ingresso."""

from __future__ import annotations

import logging

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models import Ingresso
from app.services.cupom_desconto import registrar_uso_cupom
from app.services.ticket_email import enqueue_ticket_email

logger = logging.getLogger(__name__)


def marcar_ingresso_pago(db: Session, ingresso: Ingresso) -> bool:
    """Marca como pago (sem commit). Retorna True se o status mudou."""
    if ingresso.status == "pago":
        return False

    if ingresso.status == "cancelado":
        logger.warning(
            "Pagamento confirmado para ingresso já cancelado %s (reserva expirou antes do webhook).",
            ingresso.id,
        )
        return False

    if ingresso.status == "pendente":
        from app.services.lista_espera import validar_espera_para_ingresso_pendente

        try:
            validar_espera_para_ingresso_pendente(db, ingresso, None)
        except HTTPException:
            logger.warning(
                "Pagamento bloqueado por janela exclusiva da lista de espera (ingresso %s).",
                ingresso.id,
            )
            return False

    ingresso.status = "pago"
    ingresso.reservado_ate = None
    registrar_uso_cupom(db, getattr(ingresso, "cupom_id", None))
    email = (ingresso.participante_email or "").strip()
    if email:
        from app.services.lista_espera import marcar_espera_comprada

        marcar_espera_comprada(db, ingresso.evento_id, email)
    return True


def notificar_ingresso_pago(ingresso_id: str) -> None:
    """Dispara e-mail do ingresso (após commit)."""
    enqueue_ticket_email(ingresso_id)


def _ingressos_por_ref(db: Session, payment_ref: str) -> list[Ingresso]:
    return (
        db.query(Ingresso)
        .filter(Ingresso.asaas_payment_id == payment_ref)
        .all()
    )


def marcar_ingressos_pi_pagos(db: Session, payment_ref: str) -> list[str]:
    """Marca todos os ingressos pendentes de um pagamento externo como pagos."""
    alterados: list[str] = []
    for ingresso in _ingressos_por_ref(db, payment_ref):
        if marcar_ingresso_pago(db, ingresso):
            alterados.append(ingresso.id)
    return alterados


def exigir_fulfillment_pagamento(db: Session, payment_ref: str, marcados: list[str]) -> None:
    """Reembolsa e cancela se o gateway confirmou mas ingressos não puderam ser liberados."""
    if marcados:
        return
    pendentes = [i for i in _ingressos_por_ref(db, payment_ref) if i.status == "pendente"]
    if not pendentes:
        return

    refunded = False
    pay_id = (payment_ref or "").strip()
    if pay_id and not pay_id.startswith(("disabled_", "cortesia_")):
        from app.services.asaas_client import AsaasAPIError
        from app.services.pagamento_asaas import obter_cobranca, reembolsar_cobranca, status_eh_pago

        try:
            payment = obter_cobranca(pay_id)
            if status_eh_pago(payment.get("status")):
                reembolsar_cobranca(pay_id)
                refunded = True
        except AsaasAPIError:
            logger.exception(
                "Falha ao reembolsar pagamento %s após bloqueio de fulfillment",
                pay_id,
            )

    cancelados = cancelar_ingressos_pi_pendentes(db, pay_id)
    logger.warning(
        "Pagamento %s confirmado no gateway mas %d ingresso(s) não liberado(s); "
        "reembolso_automatico=%s, cancelados=%d",
        pay_id,
        len(pendentes),
        refunded,
        cancelados,
    )


def cancelar_ingressos_pi_pendentes(db: Session, payment_ref: str) -> int:
    """Cancela reservas pendentes ligadas ao pagamento externo e avança lista de espera."""
    return _cancelar_ingressos_por_ref(
        db,
        payment_ref,
        status_permitidos=("pendente",),
        liberar_espera=True,
    )


def cancelar_ingressos_reembolsados(db: Session, payment_ref: str) -> int:
    """Cancela ingressos pagos ou pendentes após reembolso/cancelamento no gateway."""
    return _cancelar_ingressos_por_ref(
        db,
        payment_ref,
        status_permitidos=("pendente", "pago"),
        liberar_espera=True,
    )


def _cancelar_ingressos_por_ref(
    db: Session,
    payment_ref: str,
    *,
    status_permitidos: tuple[str, ...],
    liberar_espera: bool,
) -> int:
    vagas_por_evento: dict[str, int] = {}
    n = 0
    for ingresso in _ingressos_por_ref(db, payment_ref):
        if ingresso.status not in status_permitidos:
            continue
        ingresso.status = "cancelado"
        ingresso.reservado_ate = None
        n += 1
        if liberar_espera:
            from app.services.lista_espera import expirar_espera_reserva_nao_concluida

            expirar_espera_reserva_nao_concluida(db, ingresso)
            vagas_por_evento[ingresso.evento_id] = vagas_por_evento.get(ingresso.evento_id, 0) + 1
    if liberar_espera and vagas_por_evento:
        from app.services.lista_espera import liberar_vagas_apos_cancelamento

        for evento_id, qtd in vagas_por_evento.items():
            liberar_vagas_apos_cancelamento(db, evento_id, qtd)
    return n


def ingressos_lote_pendente(db: Session, ingresso: Ingresso) -> list[Ingresso]:
    """Ingressos do mesmo lote de compra (mesma reserva / mesmo payment ref)."""
    ref = (ingresso.asaas_payment_id or "").strip()
    if ref:
        return _ingressos_por_ref(db, ref)
    q = db.query(Ingresso).filter(
        Ingresso.usuario_id == ingresso.usuario_id,
        Ingresso.evento_id == ingresso.evento_id,
        Ingresso.status == "pendente",
        Ingresso.reservado_ate == ingresso.reservado_ate,
    )
    return q.all()
