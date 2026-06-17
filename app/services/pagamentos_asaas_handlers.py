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
    marcar_ingressos_pi_pagos,
    notificar_ingresso_pago,
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
from app.services.taxas_asaas_publicas import PARCELAMENTO_MINIMO_REAIS
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


def iniciar_cobranca_asaas(
    db: Session,
    usuario: Usuario,
    body: AsaasCobrancaRequest,
) -> dict:
    ingresso = _validar_ingresso_pendente(
        db.query(Ingresso).filter(Ingresso.id == body.ingresso_id).first(),
        usuario,
    )
    lote = ingressos_lote_pendente(db, ingresso)
    if not lote:
        lote = [ingresso]

    evento = db.query(Evento).filter(Evento.id == ingresso.evento_id).first()
    if not evento:
        raise HTTPException(status_code=404, detail="Evento não encontrado")

    if not (evento.asaas_wallet_id or "").strip():
        raise HTTPException(
            status_code=400,
            detail="Organizador ainda não configurou conta Asaas para repasses.",
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
                pagos = marcar_ingressos_pi_pagos(db, pay_id)
                db.commit()
                for iid in pagos:
                    notificar_ingresso_pago(iid)
                return {"ja_pago": True, "payment_id": pay_id}
            if body.metodo == "pix" and existing.get("billingType") == "PIX":
                return resposta_checkout_asaas(existing) | {
                    "ingresso_id": ingresso.id,
                    "reservado_ate": ingresso.reservado_ate.isoformat() + "Z" if ingresso.reservado_ate else None,
                }
            cancelar_cobranca_pendente(pay_id)
            for ing in lote:
                ing.asaas_payment_id = None
            db.commit()
        except AsaasAPIError as e:
            logger.warning("Cobrança Asaas anterior %s: %s", pay_id, e)

    cpf = ingresso.participante_cpf or ""
    tel = ingresso.participante_telefone or usuario.telefone
    try:
        customer_id = garantir_customer_asaas(db, usuario, cpf=cpf, telefone=tel)
    except (ValueError, AsaasAPIError) as e:
        logger.exception("Customer Asaas")
        raise HTTPException(status_code=400, detail=PAGAMENTO_CLIENTE) from e

    valor = _valor_lote_reais(lote)
    if valor <= 0:
        raise HTTPException(status_code=400, detail="Valor inválido para cobrança.")

    installment_count: int | None = None
    if body.metodo == "card" and body.parcelas and body.parcelas > 1:
        if not evento.parcelamento_habilitado:
            raise HTTPException(status_code=400, detail="Parcelamento não disponível para este evento.")
        max_p = int(evento.parcelamento_max or 2)
        if body.parcelas > max_p:
            raise HTTPException(status_code=400, detail=f"Máximo de {max_p}x para este evento.")
        if valor < PARCELAMENTO_MINIMO_REAIS:
            raise HTTPException(
                status_code=400,
                detail=f"Valor mínimo para parcelamento: R$ {PARCELAMENTO_MINIMO_REAIS:.2f}.",
            )
        installment_count = body.parcelas

    billing = "PIX" if body.metodo == "pix" else "CREDIT_CARD"
    if body.metodo == "invoice":
        billing = "UNDEFINED"

    try:
        payment = criar_cobranca_asaas(
            customer_id=customer_id,
            valor_reais=valor,
            billing_type=billing,
            external_reference=ingresso.id,
            descricao=f"Ingresso — {evento.nome}"[:500],
            evento=evento,
            credit_card=body.credit_card,
            credit_card_holder_info=body.credit_card_holder_info,
            remote_ip=body.remote_ip,
            installment_count=installment_count,
        )
    except AsaasAPIError as e:
        logger.exception("Erro Asaas ao criar cobrança")
        raise HTTPException(status_code=400, detail=PAGAMENTO_CLIENTE) from e

    pid = payment.get("id")
    if not pid:
        raise HTTPException(status_code=400, detail=PAGAMENTO_CLIENTE)

    for ing in lote:
        ing.asaas_payment_id = pid
    db.commit()

    if status_eh_pago(payment.get("status")):
        pagos = marcar_ingressos_pi_pagos(db, pid)
        db.commit()
        for iid in pagos:
            notificar_ingresso_pago(iid)
        return {"ja_pago": True, "payment_id": pid}

    out = resposta_checkout_asaas(payment)
    out["ingresso_id"] = ingresso.id
    out["reservado_ate"] = ingresso.reservado_ate.isoformat() + "Z" if ingresso.reservado_ate else None
    out["valor_centavos"] = int(round(valor * 100))
    return out


def retomar_pagamento_asaas(db: Session, ingresso: Ingresso) -> dict:
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
            "valor_centavos": int(round(float(ingresso.valor or 0) * 100)),
            "evento_slug": ingresso.evento.slug,
        }

    try:
        payment = obter_cobranca(pay_id)
    except AsaasAPIError as e:
        logger.exception("Erro ao consultar cobrança Asaas %s", pay_id)
        raise HTTPException(status_code=400, detail=PAGAMENTO_CLIENTE) from e

    if status_eh_pago(payment.get("status")):
        pagos = marcar_ingressos_pi_pagos(db, pay_id)
        if pagos:
            db.commit()
            for iid in pagos:
                notificar_ingresso_pago(iid)
        else:
            db.commit()
        return {
            "client_secret": "",
            "ingresso_id": ingresso.id,
            "ja_pago": True,
            "reservado_ate": None,
            "evento_slug": ingresso.evento.slug,
        }

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
            "valor_centavos": int(round(float(ingresso.valor or 0) * 100)),
            "evento_slug": ingresso.evento.slug,
        }
    )
    return out


def cancelar_com_reembolso_asaas(db: Session, ingresso: Ingresso) -> str | None:
    pay_id = (ingresso.asaas_payment_id or "").strip()
    if not pay_id or pay_id.startswith("disabled_") or pay_id.startswith("cortesia_"):
        return None
    try:
        result = reembolsar_cobranca(pay_id)
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
    payment = obter_cobranca(pay_id)
    pago = status_eh_pago(payment.get("status"))
    if pago:
        pagos = marcar_ingressos_pi_pagos(db, pay_id)
        db.commit()
        for iid in pagos:
            notificar_ingresso_pago(iid)
    return {"status": payment.get("status"), "pago": pago, "payment_id": pay_id}
