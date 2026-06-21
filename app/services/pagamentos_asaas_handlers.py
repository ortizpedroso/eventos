"""Handlers de cobrança Asaas (PIX, cartão, status)."""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Literal

from fastapi import HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.models import Evento, Ingresso, Usuario
from app.services.asaas_client import AsaasAPIError
from app.services.ingresso_pago import (
    ingressos_lote_pendente,
    notificar_ingresso_pago,
    processar_cobranca_confirmada_gateway,
)
from app.services.pagamento_asaas import (
    cancelar_cobranca_pendente,
    criar_cobranca_asaas,
    obter_cobranca,
    reembolsar_cobranca,
    resposta_checkout_asaas,
    status_eh_cancelado,
    status_eh_pago,
)
from app.services.usuario_asaas import garantir_customer_asaas
from app.services.taxas_asaas_publicas import (
    INGRESSO_MINIMO_PAGO_REAIS,
    PARCELAMENTO_MINIMO_REAIS,
    calcular_acrescimo_parcelamento_comprador,
)
from app.services.tarifas_plataforma import detalhar_taxa_ingresso, ledger_ingresso_venda, tarifa_para_organizador
from app.services.financeiro_organizador import registrar_ledger_ingressos_lote
from app.utils.public_errors import PAGAMENTO_CLIENTE, REEMBOLSO_CLIENTE
from config.settings import settings

logger = logging.getLogger(__name__)


class AsaasCobrancaRequest(BaseModel):
    ingresso_id: str
    metodo: Literal["pix", "card", "invoice"] = "pix"
    credit_card: dict | None = None
    credit_card_holder_info: dict | None = None
    remote_ip: str | None = Field(default=None, max_length=45)
    parcelas: int | None = Field(default=None, ge=1, le=12)
    token_espera: str | None = Field(default=None, max_length=128)


def _validar_ingresso_pendente(ingresso: Ingresso | None, usuario: Usuario) -> Ingresso:
    if not ingresso:
        raise HTTPException(status_code=404, detail="Ingresso não encontrado")
    if ingresso.usuario_id != usuario.id:
        raise HTTPException(status_code=403, detail="Sem permissão")
    if ingresso.status == "pago":
        raise HTTPException(status_code=400, detail="Ingresso já está pago.")
    if ingresso.status != "pendente":
        raise HTTPException(status_code=400, detail="Ingresso não está aguardando pagamento.")
    agora = datetime.now(timezone.utc).replace(tzinfo=None)
    if ingresso.reservado_ate and ingresso.reservado_ate < agora:
        raise HTTPException(status_code=400, detail="A reserva expirou. Inicie uma nova compra.")
    return ingresso


def _valor_lote_reais(ingressos: list[Ingresso]) -> float:
    return round(sum(float(i.valor or 0) for i in ingressos), 2)


def criar_resposta_asaas_apos_criar(
  *,
  novos: list[Ingresso],
  valor_centavos: int,
  reserva_ate: datetime,
  quantidade: int,
) -> dict:
    primeiro = novos[0]
    return {
        "payment_provider": "asaas",
        "client_secret": "",
        "ingresso_id": primeiro.id,
        "ingresso_ids": [i.id for i in novos],
        "quantidade": quantidade,
        "pix_disponivel": True,
        "valor_centavos": valor_centavos,
        "reservado_ate": reserva_ate.isoformat() + "Z",
        "aguardando_cobranca": True,
    }


def _lock_ingresso_e_lote(db: Session, ingresso_id: str, usuario: Usuario) -> Ingresso:
    """Trava ingresso e lote pendente (SELECT FOR UPDATE) para evitar cobranças duplicadas."""
    ingresso = (
        db.query(Ingresso)
        .filter(Ingresso.id == ingresso_id)
        .with_for_update()
        .first()
    )
    ingresso = _validar_ingresso_pendente(ingresso, usuario)
    pay_id = (ingresso.asaas_payment_id or "").strip()
    if pay_id:
        db.query(Ingresso).filter(Ingresso.asaas_payment_id == pay_id).with_for_update().all()
    else:
        db.query(Ingresso).filter(
            Ingresso.usuario_id == ingresso.usuario_id,
            Ingresso.evento_id == ingresso.evento_id,
            Ingresso.status == "pendente",
            Ingresso.reservado_ate == ingresso.reservado_ate,
        ).with_for_update().all()
    db.refresh(ingresso)
    return ingresso


def iniciar_cobranca_asaas(
    db: Session,
    usuario: Usuario,
    body: AsaasCobrancaRequest,
) -> dict:
    ingresso = _lock_ingresso_e_lote(db, body.ingresso_id, usuario)
    from app.services.lista_espera import validar_espera_para_ingresso_pendente

    validar_espera_para_ingresso_pendente(db, ingresso, body.token_espera)
    lote = ingressos_lote_pendente(db, ingresso)
    if not lote:
        lote = [ingresso]

    evento = db.query(Evento).filter(Evento.id == ingresso.evento_id).first()
    if not evento:
        raise HTTPException(status_code=404, detail="Evento não encontrado")

    if not (evento.asaas_wallet_id or "").strip():
        raise HTTPException(
            status_code=400,
            detail="Organizador ainda não configurou conta para repasses.",
        )
    if not (settings.ASAAS_PLATFORM_WALLET_ID or "").strip():
        raise HTTPException(
            status_code=503,
            detail="Pagamentos temporariamente indisponíveis. Contate o suporte.",
        )

    pay_id = (ingresso.asaas_payment_id or "").strip()
    if pay_id:
        try:
            existing = obter_cobranca(pay_id)
            if status_eh_pago(existing.get("status")):
                pagos = processar_cobranca_confirmada_gateway(db, pay_id)
                db.commit()
                for iid in pagos:
                    notificar_ingresso_pago(iid)
                db.refresh(ingresso)
                if ingresso.status == "pago":
                    return {"ja_pago": True, "payment_id": pay_id}
                raise HTTPException(
                    status_code=409,
                    detail=(
                        "Pagamento confirmado no gateway, mas o ingresso ainda não foi liberado. "
                        "Aguarde alguns instantes ou contate o suporte."
                    ),
                )
            if body.metodo == "pix" and existing.get("billingType") == "PIX":
                return resposta_checkout_asaas(existing) | {
                    "ingresso_id": ingresso.id,
                    "reservado_ate": ingresso.reservado_ate.isoformat() + "Z" if ingresso.reservado_ate else None,
                }
            try:
                cancelar_cobranca_pendente(pay_id)
            except AsaasAPIError as e:
                logger.warning("Falha ao cancelar cobrança Asaas %s: %s", pay_id, e)
                raise HTTPException(
                    status_code=503,
                    detail="Não foi possível alterar o método de pagamento. Tente novamente em instantes.",
                ) from e
            for ing in lote:
                ing.asaas_payment_id = None
            db.flush()
        except AsaasAPIError as e:
            logger.warning("Cobrança Asaas anterior %s: %s", pay_id, e)
            raise HTTPException(
                status_code=503,
                detail="Não foi possível consultar o pagamento anterior. Tente novamente em instantes.",
            ) from e

    cpf = ingresso.participante_cpf or ""
    tel = ingresso.participante_telefone or usuario.telefone
    try:
        customer_id = garantir_customer_asaas(db, usuario, cpf=cpf, telefone=tel)
    except (ValueError, AsaasAPIError) as e:
        logger.exception("Customer Asaas")
        raise HTTPException(status_code=400, detail=PAGAMENTO_CLIENTE) from e

    valor_base = _valor_lote_reais(lote)
    if valor_base <= 0:
        raise HTTPException(status_code=400, detail="Valor inválido para cobrança.")
    if valor_base < INGRESSO_MINIMO_PAGO_REAIS:
        raise HTTPException(
            status_code=400,
            detail=f"Valor mínimo para ingressos pagos: R$ {INGRESSO_MINIMO_PAGO_REAIS:.2f}.",
        )

    organizador = db.query(Usuario).filter(Usuario.id == evento.organizador_id).first()
    tarifa = tarifa_para_organizador(organizador)
    repasse = (getattr(evento, "repasse_parcelamento", None) or "comprador").strip()
    if repasse not in ("comprador", "organizador"):
        repasse = "comprador"

    installment_count: int | None = None
    acrescimo_parcelamento = 0.0
    desconto_organizador = 0.0
    if body.metodo == "card" and body.parcelas and body.parcelas > 1:
        if not evento.parcelamento_habilitado:
            raise HTTPException(status_code=400, detail="Parcelamento não disponível para este evento.")
        max_p = int(evento.parcelamento_max or 2)
        if body.parcelas > max_p:
            raise HTTPException(status_code=400, detail=f"Máximo de {max_p}x para este evento.")
        if valor_base < PARCELAMENTO_MINIMO_REAIS:
            raise HTTPException(
                status_code=400,
                detail=f"Valor mínimo para parcelamento: R$ {PARCELAMENTO_MINIMO_REAIS:.2f}.",
            )
        installment_count = body.parcelas
        acrescimo_parcelamento = calcular_acrescimo_parcelamento_comprador(valor_base, installment_count)
        if repasse == "organizador" and acrescimo_parcelamento > 0:
            det = detalhar_taxa_ingresso(valor_base, tarifa)
            liquido = float(det.get("liquido_organizador") or 0)
            if liquido < acrescimo_parcelamento:
                raise HTTPException(
                    status_code=400,
                    detail="O organizador não pode absorver o acréscimo de parcelamento neste valor.",
                )
            desconto_organizador = acrescimo_parcelamento
            valor_cobranca = valor_base
        else:
            valor_cobranca = round(valor_base + acrescimo_parcelamento, 2)
    else:
        valor_cobranca = valor_base

    billing = "PIX" if body.metodo == "pix" else "CREDIT_CARD"
    if body.metodo == "invoice":
        billing = "UNDEFINED"

    if body.metodo == "card":
        from app.utils.cartao_validacao import validar_dados_cartao

        try:
            validar_dados_cartao(body.credit_card, body.credit_card_holder_info)
        except ValueError as e:
            raise HTTPException(status_code=422, detail=str(e)) from e

    try:
        payment = criar_cobranca_asaas(
            customer_id=customer_id,
            valor_reais=valor_cobranca,
            valor_base_reais=valor_base,
            tarifa=tarifa,
            billing_type=billing,
            external_reference=ingresso.id,
            descricao=f"Ingresso — {evento.nome}"[:500],
            evento=evento,
            credit_card=body.credit_card,
            credit_card_holder_info=body.credit_card_holder_info,
            remote_ip=body.remote_ip,
            installment_count=installment_count,
            quantidade=len(lote),
            idempotency_key=f"cobranca_{ingresso.id}",
            desconto_organizador=desconto_organizador,
        )
    except AsaasAPIError as e:
        logger.exception("Erro Asaas ao criar cobrança")
        raise HTTPException(status_code=400, detail=PAGAMENTO_CLIENTE) from e

    pid = payment.get("id")
    if not pid:
        raise HTTPException(status_code=400, detail=PAGAMENTO_CLIENTE)

    n_lote = max(1, len(lote))
    share = round(valor_cobranca / n_lote, 2)
    for idx, ing in enumerate(lote):
        ing.asaas_payment_id = pid
        if idx == n_lote - 1:
            ing.valor_cobrado = round(valor_cobranca - share * (n_lote - 1), 2)
        else:
            ing.valor_cobrado = share
    registrar_ledger_ingressos_lote(
        lote,
        tarifa=tarifa,
        desconto_parcelamento_total=desconto_organizador,
        parcelas=installment_count,
    )
    db.commit()

    if status_eh_pago(payment.get("status")):
        pagos = processar_cobranca_confirmada_gateway(db, pid)
        db.commit()
        for iid in pagos:
            notificar_ingresso_pago(iid)
        db.refresh(ingresso)
        if ingresso.status == "pago":
            return {"ja_pago": True, "payment_id": pid}
        raise HTTPException(
            status_code=409,
            detail=(
                "Pagamento confirmado no gateway, mas o ingresso ainda não foi liberado. "
                "Aguarde alguns instantes ou contate o suporte."
            ),
        )

    out = resposta_checkout_asaas(payment)
    out["ingresso_id"] = ingresso.id
    out["reservado_ate"] = ingresso.reservado_ate.isoformat() + "Z" if ingresso.reservado_ate else None
    out["valor_centavos"] = int(round(valor_cobranca * 100))
    return out


def retomar_pagamento_asaas(db: Session, ingresso: Ingresso) -> dict:
    lote_pendente = ingressos_lote_pendente(db, ingresso) or [ingresso]
    valor_base_centavos = int(round(_valor_lote_reais(lote_pendente) * 100))

    pay_id = (ingresso.asaas_payment_id or "").strip()
    if not pay_id:
        return {
            "payment_provider": "asaas",
            "client_secret": "",
            "ingresso_id": ingresso.id,
            "aguardando_cobranca": True,
            "pix_disponivel": True,
            "reservado_ate": ingresso.reservado_ate.isoformat() + "Z" if ingresso.reservado_ate else None,
            "participante_nome": ingresso.participante_nome,
            "participante_email": ingresso.participante_email,
            "valor_centavos": valor_base_centavos,
            "evento_slug": ingresso.evento.slug,
        }

    try:
        payment = obter_cobranca(pay_id)
    except AsaasAPIError as e:
        logger.exception("Erro ao consultar cobrança Asaas %s", pay_id)
        raise HTTPException(status_code=400, detail=PAGAMENTO_CLIENTE) from e

    valor_cobranca_centavos = int(round(float(payment.get("value") or 0) * 100)) or valor_base_centavos

    if status_eh_pago(payment.get("status")):
        pagos = processar_cobranca_confirmada_gateway(db, pay_id)
        db.commit()
        for iid in pagos:
            notificar_ingresso_pago(iid)
        db.refresh(ingresso)
        if ingresso.status == "pago":
            return {
                "client_secret": "",
                "ingresso_id": ingresso.id,
                "ja_pago": True,
                "reservado_ate": None,
                "evento_slug": ingresso.evento.slug,
            }
        raise HTTPException(
            status_code=409,
            detail=(
                "Pagamento confirmado no gateway, mas o ingresso ainda não foi liberado. "
                "Aguarde alguns instantes ou contate o suporte."
            ),
        )

    if status_eh_cancelado(payment.get("status")):
        raise HTTPException(
            status_code=400,
            detail="O pagamento anterior expirou. Inicie uma nova compra no evento.",
        )

    out = resposta_checkout_asaas(payment)
    out.update(
        {
            "ingresso_id": ingresso.id,
            "reservado_ate": ingresso.reservado_ate.isoformat() + "Z" if ingresso.reservado_ate else None,
            "participante_nome": ingresso.participante_nome,
            "participante_email": ingresso.participante_email,
            "valor_centavos": valor_cobranca_centavos,
            "evento_slug": ingresso.evento.slug,
        }
    )
    return out


def cancelar_com_reembolso_asaas(db: Session, ingresso: Ingresso) -> str | None:
    pay_id = (ingresso.asaas_payment_id or "").strip()
    if not pay_id or pay_id.startswith(("disabled_", "cortesia_", "legacy_stripe:")):
        return None
    outros_pagos = (
        db.query(Ingresso)
        .filter(
            Ingresso.asaas_payment_id == pay_id,
            Ingresso.id != ingresso.id,
            Ingresso.status == "pago",
        )
        .count()
    )
    valor = float(getattr(ingresso, "valor_cobrado", None) or ingresso.valor or 0)
    try:
        idem_key = f"refund_{pay_id}_{ingresso.id}"
        if outros_pagos > 0:
            result = reembolsar_cobranca(pay_id, valor=valor, idempotency_key=idem_key)
        else:
            result = reembolsar_cobranca(pay_id, idempotency_key=idem_key)
        return result.get("id") or pay_id
    except AsaasAPIError as e:
        logger.exception("Erro Asaas reembolso")
        raise HTTPException(status_code=400, detail=REEMBOLSO_CLIENTE) from e


def status_cobranca_asaas(db: Session, ingresso_id: str, usuario: Usuario) -> dict:
    ingresso = db.query(Ingresso).filter(Ingresso.id == ingresso_id).first()
    if not ingresso:
        raise HTTPException(status_code=404, detail="Ingresso não encontrado")
    if ingresso.usuario_id != usuario.id:
        raise HTTPException(status_code=403, detail="Sem permissão")
    if ingresso.status == "pago":
        return {"status": "CONFIRMED", "pago": True, "payment_id": ingresso.asaas_payment_id}
    if ingresso.status != "pendente":
        raise HTTPException(status_code=400, detail="Ingresso não está aguardando pagamento.")

    pay_id = (ingresso.asaas_payment_id or "").strip()
    if not pay_id:
        return {"status": "SEM_COBRANCA", "pago": False}
    try:
        payment = obter_cobranca(pay_id)
    except AsaasAPIError as e:
        logger.exception("Erro ao consultar cobrança Asaas %s", pay_id)
        raise HTTPException(status_code=400, detail=PAGAMENTO_CLIENTE) from e
    pago_gateway = status_eh_pago(payment.get("status"))
    if pago_gateway:
        pagos = processar_cobranca_confirmada_gateway(db, pay_id, payment=payment)
        db.commit()
        for iid in pagos:
            notificar_ingresso_pago(iid)
    db.refresh(ingresso)
    return {
        "status": payment.get("status"),
        "pago": ingresso.status == "pago",
        "payment_id": pay_id,
    }
