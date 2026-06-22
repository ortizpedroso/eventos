"""Ações ao confirmar pagamento de um ingresso."""

from __future__ import annotations

import logging

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models import Ingresso
from app.services.cupom_desconto import registrar_uso_cupom
from app.services.ticket_email import enqueue_ticket_email

logger = logging.getLogger(__name__)


def _garantir_ledger_ingresso(db: Session, ingresso: Ingresso) -> None:
    """Preenche ledger em ingressos antigos sem valores gravados."""
    if getattr(ingresso, "liquido_repassado", None) is not None:
        return
    from app.models import Evento, Usuario
    from app.services.tarifas_plataforma import ledger_ingresso_venda, TARIFAS, tarifa_para_organizador
    from app.services.taxas_asaas_publicas import calcular_acrescimo_parcelamento_comprador

    evento = db.get(Evento, ingresso.evento_id)
    if not evento:
        return
    organizador = db.get(Usuario, evento.organizador_id)
    valor = float(ingresso.valor or 0)
    parcelas = int(getattr(ingresso, "parcelas_cobranca", None) or 1)
    repasse = (getattr(evento, "repasse_parcelamento", None) or "comprador").strip()
    acrescimo_bruto = (
        calcular_acrescimo_parcelamento_comprador(valor, parcelas) if parcelas > 1 and valor > 0 else 0.0
    )
    desconto_total = acrescimo_bruto if repasse == "organizador" else 0.0

    plano_venda = (getattr(ingresso, "plano_tarifa_venda", None) or "").strip().lower()
    if plano_venda in TARIFAS:
        tarifa = TARIFAS[plano_venda]  # type: ignore[index]
    else:
        tarifa = tarifa_para_organizador(organizador)
    ledger = ledger_ingresso_venda(
        valor,
        tarifa=tarifa,
        desconto_parcelamento_total=desconto_total,
        parcelas=parcelas if parcelas > 1 else None,
    )
    ingresso.liquido_repassado = ledger["liquido_repassado"]
    ingresso.taxa_plataforma_aplicada = ledger["taxa_plataforma_aplicada"]
    ingresso.desconto_parcelamento_organizador = ledger["desconto_parcelamento_organizador"]
    ingresso.parcelas_cobranca = ledger["parcelas_cobranca"]
    ingresso.plano_tarifa_venda = ledger["plano_tarifa_venda"]
    if getattr(ingresso, "valor_cobrado", None) is None and valor > 0:
        acrescimo_comprador = 0.0 if repasse == "organizador" else acrescimo_bruto
        ingresso.valor_cobrado = round(valor + acrescimo_comprador, 2)


def _pay_id_reembolsavel(pay_id: str) -> bool:
    return bool(pay_id) and not pay_id.startswith(("disabled_", "cortesia_", "legacy_stripe:"))


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
    _garantir_ledger_ingresso(db, ingresso)
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


def _lock_ingressos_por_ref(db: Session, payment_ref: str) -> list[Ingresso]:
    pay_id = (payment_ref or "").strip()
    if not pay_id:
        return []
    return (
        db.query(Ingresso)
        .filter(Ingresso.asaas_payment_id == pay_id)
        .with_for_update()
        .all()
    )


def _obter_cobranca_gateway(pay_id: str, *, raise_on_error: bool = False) -> dict | None:
    from app.services.asaas_client import AsaasAPIError
    from app.services.pagamento_asaas import obter_cobranca

    try:
        return obter_cobranca(pay_id)
    except AsaasAPIError:
        logger.exception("Falha ao consultar cobrança %s no gateway", pay_id)
        if raise_on_error:
            raise
        return None


def _tentar_reembolsar_gateway(pay_id: str, payment: dict) -> bool:
    """Solicita reembolso no Asaas. Retorna True se já estava reembolsado ou se a API aceitou."""
    from app.services.asaas_client import AsaasAPIError
    from app.services.pagamento_asaas import reembolsar_cobranca, status_eh_pago, status_eh_reembolsado

    status = (payment.get("status") or "").upper()
    if status_eh_reembolsado(status):
        return True
    if not status_eh_pago(status):
        return False

    try:
        reembolsar_cobranca(pay_id, idempotency_key=f"refund_{pay_id}")
        return True
    except AsaasAPIError:
        logger.exception("Falha ao reembolsar pagamento órfão %s", pay_id)
        return False


def exigir_fulfillment_pagamento(
    db: Session,
    payment_ref: str,
    marcados: list[str],
    *,
    payment: dict | None = None,
    raise_on_gateway_error: bool = False,
) -> None:
    """Reembolsa no gateway se pago mas ingresso não pôde ser emitido; cancela só após reembolso OK."""
    if marcados:
        return

    pay_id = (payment_ref or "").strip()
    if not pay_id or not _pay_id_reembolsavel(pay_id):
        return

    locked = _lock_ingressos_por_ref(db, pay_id)
    if any(i.status == "pago" for i in locked):
        return

    pendentes = [i for i in locked if i.status == "pendente"]
    cancelados = [i for i in locked if i.status == "cancelado"]
    if not pendentes and not cancelados:
        return

    if payment is None:
        payment = _obter_cobranca_gateway(pay_id, raise_on_error=raise_on_gateway_error)
    if not payment:
        return

    from app.services.pagamento_asaas import status_eh_pago, status_eh_reembolsado

    status = payment.get("status")
    if status_eh_reembolsado(status):
        if pendentes:
            cancelar_ingressos_pi_pendentes(db, pay_id)
        return

    if not status_eh_pago(status):
        return

    refunded = _tentar_reembolsar_gateway(pay_id, payment)
    if not refunded:
        logger.error(
            "Pagamento %s confirmado no gateway mas ingresso(s) não liberado(s); "
            "reembolso falhou — reservas mantidas para reconciliação manual",
            pay_id,
        )
        return

    if pendentes:
        n = cancelar_ingressos_pi_pendentes(db, pay_id)
        logger.warning(
            "Pagamento %s órfão: reembolsado automaticamente; %d reserva(s) cancelada(s)",
            pay_id,
            n,
        )
    else:
        logger.warning(
            "Pagamento %s órfão em ingresso(s) já cancelado(s): reembolsado automaticamente",
            pay_id,
        )


def processar_cobranca_confirmada_gateway(
    db: Session,
    payment_ref: str,
    *,
    payment: dict | None = None,
    raise_on_gateway_error: bool = False,
) -> list[str]:
    """Consulta o Asaas, marca ingressos pagos ou reembolsa se fulfillment bloqueado."""
    pay_id = (payment_ref or "").strip()
    if not pay_id or pay_id.startswith(("disabled_", "cortesia_", "legacy_stripe:")):
        return []

    if payment is None or not (payment.get("status") or "").strip():
        payment = _obter_cobranca_gateway(pay_id, raise_on_error=raise_on_gateway_error)
    elif not isinstance(payment, dict):
        payment = {}

    if not payment:
        return []

    from app.services.pagamento_asaas import status_eh_pago

    if not status_eh_pago(payment.get("status")):
        return []

    marcados = marcar_ingressos_pi_pagos(db, pay_id)
    exigir_fulfillment_pagamento(
        db,
        pay_id,
        marcados,
        payment=payment,
        raise_on_gateway_error=raise_on_gateway_error,
    )
    return marcados


def marcar_ingressos_pi_pagos(db: Session, payment_ref: str) -> list[str]:
    """Marca todos os ingressos pendentes de um pagamento externo como pagos."""
    alterados: list[str] = []
    for ingresso in _ingressos_por_ref(db, payment_ref):
        if marcar_ingresso_pago(db, ingresso):
            alterados.append(ingresso.id)
    return alterados


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
