"""Assinatura mensal EventosBR (plano com taxa reduzida por ingresso)."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from app.models import Usuario
from app.services.tarifas_plataforma import MENSALIDADE_ASSINATURA_MENSAL


def status_assinatura(usuario: Usuario) -> dict:
    agora = datetime.now(timezone.utc).replace(tzinfo=None)
    valida_ate = getattr(usuario, "assinatura_valida_ate", None)
    ativa = bool(valida_ate and valida_ate >= agora)
    return {
        "plano_solicitado": (getattr(usuario, "plano_tarifa", None) or "padrao").strip().lower(),
        "assinatura_ativa": ativa,
        "valida_ate": valida_ate.isoformat() if valida_ate else None,
        "mensalidade_reais": MENSALIDADE_ASSINATURA_MENSAL,
        "taxa_efetiva": "assinatura" if ativa else "padrao",
    }


def renovar_assinatura_meses(db: Session, usuario: Usuario, *, meses: int = 1) -> Usuario:
    """Estende validade da assinatura (chamado após pagamento confirmado ou admin)."""
    if usuario.tipo != "organizador":
        raise ValueError("Apenas organizadores podem ter assinatura.")
    agora = datetime.now(timezone.utc).replace(tzinfo=None)
    base = getattr(usuario, "assinatura_valida_ate", None)
    if base and base > agora:
        inicio = base
    else:
        inicio = agora
    usuario.plano_tarifa = "assinatura"
    usuario.assinatura_valida_ate = inicio + timedelta(days=30 * max(1, meses))
    usuario.data_atualizacao = agora
    db.commit()
    db.refresh(usuario)
    return usuario


def cancelar_assinatura(db: Session, usuario: Usuario) -> Usuario:
    agora = datetime.now(timezone.utc).replace(tzinfo=None)
    usuario.plano_tarifa = "padrao"
    usuario.assinatura_valida_ate = None
    usuario.data_atualizacao = agora
    db.commit()
    db.refresh(usuario)
    return usuario


def iniciar_cobranca_assinatura(db: Session, usuario: Usuario) -> dict:
    """Gera cobrança PIX da mensalidade (100% plataforma, sem split de ingresso)."""
    from datetime import date, timedelta

    from app.services.asaas_client import AsaasAPIError
    from app.services.pagamento_asaas import resposta_checkout_asaas, status_eh_pago
    from app.services.usuario_asaas import garantir_customer_asaas
    from config.settings import settings

    if usuario.tipo != "organizador":
        raise ValueError("Apenas organizadores podem contratar assinatura.")
    if not settings.use_asaas:
        raise ValueError("Pagamentos indisponíveis neste ambiente.")

    customer_id = garantir_customer_asaas(db, usuario)
    ref = f"assinatura:{usuario.id}"[:100]
    client = __import__("app.services.asaas_client", fromlist=["get_asaas_client"]).get_asaas_client()
    payload = {
        "customer": customer_id,
        "billingType": "PIX",
        "value": round(MENSALIDADE_ASSINATURA_MENSAL, 2),
        "dueDate": (date.today() + timedelta(days=1)).isoformat(),
        "description": "Assinatura EventosBR — mensal",
        "externalReference": ref,
    }
    try:
        payment = client.post("/v3/payments", json=payload, idempotency_key=f"assinatura_{usuario.id}")
    except AsaasAPIError as e:
        raise ValueError("Não foi possível gerar cobrança da assinatura.") from e

    if status_eh_pago(payment.get("status")):
        if (getattr(usuario, "assinatura_ultimo_payment_id", None) or "").strip() == (payment.get("id") or ""):
            return {"ja_pago": True, "payment_id": payment.get("id")}
        usuario.assinatura_ultimo_payment_id = payment.get("id")
        renovar_assinatura_meses(db, usuario)
        return {"ja_pago": True, "payment_id": payment.get("id")}

    pay_id = (payment.get("id") or "").strip()
    if pay_id:
        usuario.assinatura_renovacao_payment_id = pay_id
        db.commit()

    return {
        "payment_id": payment.get("id"),
        **resposta_checkout_asaas(payment),
    }


def processar_pagamento_assinatura_gateway(
    db: Session,
    payment: dict,
    *,
    raise_on_gateway_error: bool = False,
) -> bool:
    """Retorna True se o pagamento era assinatura e foi processado."""
    from app.services.asaas_client import AsaasAPIError
    from app.services.pagamento_asaas import obter_cobranca, status_eh_pago

    pay_id = (payment.get("id") or "").strip()
    if not pay_id:
        return False

    if not (payment.get("status") or "").strip() or not (payment.get("externalReference") or "").strip():
        try:
            payment = obter_cobranca(pay_id)
        except AsaasAPIError:
            if raise_on_gateway_error:
                raise
            return False

    ref = (payment.get("externalReference") or "").strip()
    if not ref.startswith("assinatura:"):
        return False
    if not status_eh_pago(payment.get("status")):
        return False

    valor = round(float(payment.get("value") or 0), 2)
    if abs(valor - round(MENSALIDADE_ASSINATURA_MENSAL, 2)) > 0.01:
        return False

    org_id = ref.split(":", 1)[1].strip()
    if not org_id:
        return False
    usuario = db.get(Usuario, org_id)
    if not usuario or usuario.tipo != "organizador":
        return False

    customer = (payment.get("customer") or "").strip()
    if not usuario.asaas_customer_id or not customer or customer != usuario.asaas_customer_id:
        return False

    renovacao = (getattr(usuario, "assinatura_renovacao_payment_id", None) or "").strip()
    ultimo = (getattr(usuario, "assinatura_ultimo_payment_id", None) or "").strip()
    if pay_id != renovacao and pay_id != ultimo:
        return False

    if ultimo == pay_id:
        return True

    usuario.assinatura_ultimo_payment_id = pay_id
    usuario.assinatura_renovacao_payment_id = None
    usuario.assinatura_aviso_expiracao_enviado_em = None
    renovar_assinatura_meses(db, usuario)
    return True


def limpar_renovacao_assinatura_pendente(db: Session, payment_id: str) -> bool:
    """Remove cobrança de renovação pendente/expirada para permitir nova geração."""
    pay_id = (payment_id or "").strip()
    if not pay_id:
        return False
    from app.models import Usuario

    rows = (
        db.query(Usuario)
        .filter(Usuario.assinatura_renovacao_payment_id == pay_id)
        .all()
    )
    if not rows:
        return False
    for u in rows:
        u.assinatura_renovacao_payment_id = None
    db.commit()
    return True


def processar_reembolso_assinatura_gateway(db: Session, payment: dict) -> bool:
    """Cancela assinatura se o pagamento reembolsado era mensalidade."""
    ref = (payment.get("externalReference") or "").strip()
    if not ref.startswith("assinatura:"):
        return False
    org_id = ref.split(":", 1)[1].strip()
    if not org_id:
        return False
    usuario = db.get(Usuario, org_id)
    if not usuario:
        return False
    pay_id = (payment.get("id") or "").strip()
    if pay_id and (getattr(usuario, "assinatura_ultimo_payment_id", None) or "").strip() == pay_id:
        cancelar_assinatura(db, usuario)
        return True
    return False
