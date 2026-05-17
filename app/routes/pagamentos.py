import logging
import uuid
from datetime import datetime, timedelta, timezone

import stripe
from email_validator import EmailNotValidError, validate_email
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field, field_validator
from sqlalchemy.orm import Session

from app.models import Usuario, Evento, Ingresso, Cancelamento, get_db
from app.deps.rate_limit import rate_limit_checkout
from app.routes.auth import get_usuario_atual
from app.services.cpf_limite import validar_limite_cpf_evento
from app.services.cupom_desconto import centavos_com_cupom, resolver_cupom_evento
from app.services.ticket_email import enqueue_ticket_email
from app.services.ingresso_lotes import resolver_lote_compra
from app.utils.cpf import cpf_valido, normalizar_cpf
from app.utils.ingresso_tipos import lote_e_cortesia
from app.utils.privacy import mask_cpf, mask_telefone_br
from app.utils.public_errors import REEMBOLSO_CLIENTE, STRIPE_CLIENTE
from config.settings import settings

logger = logging.getLogger(__name__)
router = APIRouter()
stripe.api_key = settings.STRIPE_SECRET_KEY


def _stripe_erro_pix_inativo(err: stripe.error.StripeError) -> bool:
    msg = str(err).lower()
    return "pix" in msg and ("invalid" in msg or "not enabled" in msg or "not activated" in msg)


def _criar_payment_intent_brl(
    *,
    amount: int,
    customer_id: str,
    metadata: dict,
    transfer_destination: str | None,
) -> tuple[stripe.PaymentIntent, bool]:
    """
    Cria PaymentIntent com card+pix quando a conta Stripe tiver PIX ativo.
    Retorna (intent, pix_disponivel).
    """
    base: dict = {
        "amount": amount,
        "currency": "brl",
        "customer": customer_id,
        "metadata": metadata,
    }
    if transfer_destination:
        base["transfer_data"] = {"destination": transfer_destination}

    com_pix: dict = {
        **base,
        "payment_method_types": ["card", "pix"],
        "payment_method_options": {"pix": {"expires_after_seconds": 3600}},
    }
    try:
        return stripe.PaymentIntent.create(**com_pix), True
    except stripe.error.InvalidRequestError as e:
        if not _stripe_erro_pix_inativo(e):
            raise
        logger.warning(
            "PIX não habilitado no Dashboard Stripe; PaymentIntent só com cartão (automatic_payment_methods)."
        )
        so_cartao: dict = {**base, "automatic_payment_methods": {"enabled": True}}
        return stripe.PaymentIntent.create(**so_cartao), False

class CriarPagamentoRequest(BaseModel):
    evento_id: str
    # Preferir sempre centavos (inteiro) para evitar erro de arredondamento.
    valor_centavos: int | None = Field(default=None, ge=0)
    # Compatibilidade: aceita "valor" em reais (float) temporariamente.
    valor: float | None = Field(default=None, ge=0)
    # Quem vai ao evento (opcional: se omitido, usa o comprador = responsável financeiro).
    participante_nome: str | None = Field(default=None, max_length=200)
    participante_email: str | None = Field(default=None, max_length=255)
    participante_cpf: str | None = Field(default=None, max_length=20)
    participante_telefone: str | None = Field(default=None, max_length=30)
    cortesia_responsavel: str | None = Field(default=None, max_length=200)
    codigo_cupom: str | None = Field(default=None, max_length=40)

    @field_validator("participante_nome", mode="before")
    @classmethod
    def _strip_nome(cls, v):
        if v is None:
            return None
        if isinstance(v, str):
            s = v.strip()
            return s or None
        return v

    @field_validator("participante_email", mode="before")
    @classmethod
    def _strip_email(cls, v):
        if v is None:
            return None
        if isinstance(v, str):
            s = v.strip()
            return s or None
        return v

    @field_validator(
        "participante_cpf", "participante_telefone", "cortesia_responsavel", "codigo_cupom", mode="before"
    )
    @classmethod
    def _strip_opcional(cls, v):
        if v is None:
            return None
        if isinstance(v, str):
            s = v.strip()
            return s or None
        return v


class CancelarIngressoRequest(BaseModel):
    ingresso_id: str


class ValidarCupomRequest(BaseModel):
    evento_id: str
    codigo_cupom: str = Field(min_length=3, max_length=40)


@router.post("/validar-cupom")
async def validar_cupom_checkout(
    body: ValidarCupomRequest,
    usuario_atual: Usuario = Depends(get_usuario_atual),
    db: Session = Depends(get_db),
):
    """Calcula preço com cupom para exibir no checkout (sem criar pagamento)."""
    evento = db.query(Evento).filter(Evento.id == body.evento_id).first()
    if not evento or not evento.publicado:
        raise HTTPException(status_code=404, detail="Evento não encontrado")

    lote = resolver_lote_compra(db, evento)
    if lote is None:
        raise HTTPException(status_code=400, detail="Não há lote disponível para compra.")

    eh_cortesia = lote_e_cortesia(getattr(lote, "tipo", None)) or float(lote.preco or 0) <= 0
    if eh_cortesia:
        raise HTTPException(status_code=400, detail="Cupom não se aplica a ingresso cortesia.")

    base_centavos = int(round(float(lote.preco) * 100))
    try:
        cupom = resolver_cupom_evento(db, evento.id, body.codigo_cupom)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e

    final_centavos = centavos_com_cupom(base_centavos, cupom)
    return {
        "codigo": cupom.codigo,
        "tipo": cupom.tipo,
        "valor_centavos": final_centavos,
        "desconto_centavos": base_centavos - final_centavos,
        "valor_reais": final_centavos / 100,
    }


@router.post("/criar")
async def criar_pagamento(
    body: CriarPagamentoRequest,
    usuario_atual: Usuario = Depends(get_usuario_atual),
    db: Session = Depends(get_db),
    _rate: None = Depends(rate_limit_checkout),
):
    """Cria pagamento"""
    if body.valor_centavos is None and body.valor is None:
        raise HTTPException(status_code=400, detail="Informe valor_centavos (recomendado) ou valor")

    if body.valor_centavos is not None:
        valor_centavos = int(body.valor_centavos)
        valor_reais = valor_centavos / 100
    else:
        valor_centavos = int(round(float(body.valor or 0) * 100))
        valor_reais = float(body.valor or 0)

    # Valida se o evento existe
    evento = db.query(Evento).filter(Evento.id == body.evento_id).first()
    if not evento:
        raise HTTPException(status_code=404, detail="Evento não encontrado")

    if not evento.publicado:
        raise HTTPException(
            status_code=403,
            detail="Evento pausado: não é possível comprar ingressos até ser republicado.",
        )

    nome_req = (body.participante_nome or "").strip() or None
    email_req = (body.participante_email or "").strip() or None
    if (nome_req and not email_req) or (email_req and not nome_req):
        raise HTTPException(
            status_code=400,
            detail="Informe nome e e-mail do participante, ou deixe ambos em branco para usar os dados de quem paga.",
        )

    compra_para_terceiro = bool(nome_req and email_req)
    p_cpf: str | None = None
    p_tel: str | None = None
    if compra_para_terceiro:
        cpf_digits = normalizar_cpf(body.participante_cpf)
        if not cpf_valido(cpf_digits):
            raise HTTPException(status_code=400, detail="CPF do participante inválido")
        tel_digits = "".join(c for c in (body.participante_telefone or "") if c.isdigit())
        if len(tel_digits) < 10 or len(tel_digits) > 13:
            raise HTTPException(
                status_code=400,
                detail="Telefone do participante inválido (informe DDD + número, 10 a 13 dígitos).",
            )
        p_cpf = cpf_digits
        p_tel = tel_digits
        pn = nome_req
        pe = email_req
    else:
        pn = nome_req or usuario_atual.nome
        pe = email_req or usuario_atual.email

    try:
        validate_email(pe, check_deliverability=False)
    except EmailNotValidError:
        raise HTTPException(status_code=400, detail="E-mail do participante inválido")

    lote = resolver_lote_compra(db, evento)
    if lote is None:
        raise HTTPException(
            status_code=400,
            detail="Não há lote de ingressos disponível para compra (esgotado ou fora do período de vendas).",
        )

    eh_cortesia = lote_e_cortesia(getattr(lote, "tipo", None)) or float(lote.preco or 0) <= 0
    esperado_centavos = 0 if eh_cortesia else int(round(float(lote.preco) * 100))
    cupom_id: str | None = None
    codigo_cupom = (body.codigo_cupom or "").strip()
    if codigo_cupom and not eh_cortesia:
        try:
            cupom = resolver_cupom_evento(db, evento.id, codigo_cupom)
            esperado_centavos = centavos_com_cupom(esperado_centavos, cupom)
            cupom_id = cupom.id
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e)) from e
    elif codigo_cupom and eh_cortesia:
        raise HTTPException(status_code=400, detail="Cupom não se aplica a ingresso cortesia.")

    valor_centavos = esperado_centavos
    valor_reais = valor_centavos / 100
    if body.valor_centavos is not None and int(body.valor_centavos) != valor_centavos:
        raise HTTPException(
            status_code=400,
            detail=f"Valor incorreto para o lote atual ({lote.nome}). Recarregue a página e tente novamente.",
        )
    if not eh_cortesia and valor_centavos < 50:
        raise HTTPException(status_code=400, detail="Valor mínimo de R$ 0,50 para ingressos pagos.")

    limite_cpf = getattr(evento, "limite_ingressos_por_cpf", None)
    cpf_limite: str | None = p_cpf
    if limite_cpf and limite_cpf >= 1:
        if compra_para_terceiro:
            cpf_limite = p_cpf
        else:
            cpf_limite = normalizar_cpf(body.participante_cpf)
            if not cpf_valido(cpf_limite):
                raise HTTPException(
                    status_code=400,
                    detail="Informe o CPF do participante (obrigatório neste evento).",
                )
            p_cpf = cpf_limite
        try:
            validar_limite_cpf_evento(db, evento, cpf_limite or "")
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e)) from e

    resp_cortesia = (body.cortesia_responsavel or "").strip() or None
    if eh_cortesia and not resp_cortesia:
        raise HTTPException(
            status_code=400,
            detail="Informe quem autorizou a cortesia (nome do responsável).",
        )

    def _ingresso_gratis(fake_prefix: str = "cortesia") -> dict:
        agora = datetime.now(timezone.utc).replace(tzinfo=None)
        fake_pi = f"{fake_prefix}_{uuid.uuid4().hex}"
        novo = Ingresso(
            evento_id=evento.id,
            usuario_id=usuario_atual.id,
            lote_id=lote.id,
            participante_nome=pn,
            participante_email=pe,
            participante_cpf=p_cpf,
            participante_telefone=p_tel,
            cortesia_responsavel=resp_cortesia if eh_cortesia else None,
            valor=valor_reais,
            stripe_payment_intent_id=fake_pi,
            status="pago",
            data_compra=agora,
            data_limite_cancelamento=agora + timedelta(days=10),
        )
        db.add(novo)
        db.commit()
        db.refresh(novo)
        enqueue_ticket_email(novo.id)
        return {
            "client_secret": "",
            "ingresso_id": novo.id,
            "stripe_disabled": True,
            "cortesia": eh_cortesia,
        }

    if eh_cortesia:
        logger.info("Ingresso cortesia (R$ 0) evento %s lote %s", evento.id, lote.id)
        return _ingresso_gratis("cortesia")

    logger.info("Criando pagamento R$ %.2f evento %s", valor_reais, body.evento_id)

    if settings.STRIPE_DISABLED:
        logger.warning("STRIPE_DISABLED: ingresso pago sem Stripe evento %s", evento.id)
        return _ingresso_gratis("disabled")

    if not usuario_atual.stripe_customer_id:
        raise HTTPException(
            status_code=400,
            detail="Cliente Stripe não encontrado. Refaça o cadastro ou contate o suporte.",
        )

    try:
        intent, pix_disponivel = _criar_payment_intent_brl(
            amount=valor_centavos,
            customer_id=usuario_atual.stripe_customer_id,
            metadata={
                "evento_id": evento.id,
                "usuario_id": usuario_atual.id,
                "participante_nome": (pn or "")[:450],
                "participante_email": (pe or "")[:450],
            },
            transfer_destination=evento.stripe_account_id,
        )

        # Cria o registro do Ingresso pendente no banco
        novo_ingresso = Ingresso(
            evento_id=evento.id,
            usuario_id=usuario_atual.id,
            lote_id=lote.id,
            participante_nome=pn,
            participante_email=pe,
            participante_cpf=p_cpf,
            participante_telefone=p_tel,
            cupom_id=cupom_id,
            valor=valor_reais,
            stripe_payment_intent_id=intent.id,
            status="pendente",
        )
        db.add(novo_ingresso)
        db.commit()
        db.refresh(novo_ingresso)

        return {
            "client_secret": intent.client_secret,
            "ingresso_id": novo_ingresso.id,
            "pix_disponivel": pix_disponivel,
            "valor_centavos": valor_centavos,
            "cupom_aplicado": cupom_id is not None,
        }
        
    except stripe.error.StripeError as e:
        logger.exception("Erro Stripe ao criar pagamento")
        raise HTTPException(status_code=400, detail=STRIPE_CLIENTE) from e

@router.get("/meus")
async def listar_meus_pagamentos(
    usuario_atual: Usuario = Depends(get_usuario_atual),
    db: Session = Depends(get_db),
    status: str = Query(None, description="Filtrar por status: pendente, pago, cancelado, usado")
):
    """Lista pagamentos do usuário"""
    
    query = db.query(Ingresso).filter(Ingresso.usuario_id == usuario_atual.id)
    
    if status:
        query = query.filter(Ingresso.status == status)
    
    ingressos = query.all()

    return [
        {
            "id": ingresso.id,
            "evento": {
                "id": ingresso.evento.id,
                "nome": ingresso.evento.nome,
                "data": ingresso.evento.data_inicio,
                "data_fim": ingresso.evento.data_fim,
                "local": ingresso.evento.local,
                "mensagem_confirmacao": ingresso.evento.mensagem_confirmacao,
            },
            "participante_nome": ingresso.participante_nome,
            "participante_email": ingresso.participante_email,
            "participante_cpf": mask_cpf(ingresso.participante_cpf),
            "participante_telefone": mask_telefone_br(ingresso.participante_telefone),
            "valor": ingresso.valor,
            "status": ingresso.status,
            "data_compra": ingresso.data_compra,
            "data_limite_cancelamento": ingresso.data_limite_cancelamento,
        }
        for ingresso in ingressos
    ]

@router.post("/cancelar")
async def cancelar_ingresso(
    request: CancelarIngressoRequest,
    usuario_atual: Usuario = Depends(get_usuario_atual),
    db: Session = Depends(get_db)
):
    """Cancela um ingresso e solicita reembolso"""
    
    ingresso = db.query(Ingresso).filter(Ingresso.id == request.ingresso_id).first()
    
    if not ingresso:
        raise HTTPException(status_code=404, detail="Ingresso não encontrado")
    
    if ingresso.usuario_id != usuario_atual.id:
        raise HTTPException(status_code=403, detail="Sem permissão para cancelar este ingresso")
    
    if ingresso.status != "pago":
        raise HTTPException(status_code=400, detail="Apenas ingressos pagos podem ser cancelados")

    # Idempotência: se já existe cancelamento, não processa novamente
    cancelamento_existente = db.query(Cancelamento).filter(Cancelamento.ingresso_id == ingresso.id).first()
    if cancelamento_existente and cancelamento_existente.status == "processado":
        return {
            "mensagem": "Ingresso já estava cancelado",
            "valor_reembolso": cancelamento_existente.valor_reembolso,
            "refund_id": cancelamento_existente.stripe_refund_id,
            "idempotent": True,
        }
    
    if datetime.now(timezone.utc).replace(tzinfo=None) > ingresso.data_limite_cancelamento:
        raise HTTPException(status_code=400, detail="Prazo para cancelamento expirou")

    agora = datetime.now(timezone.utc).replace(tzinfo=None)
    skip_stripe_refund = settings.STRIPE_DISABLED or (
        ingresso.stripe_payment_intent_id or ""
    ).startswith("disabled_")

    try:
        if skip_stripe_refund:
            refund_id: str | None = None
            logger.warning(
                "Cancelamento sem reembolso Stripe (STRIPE_DISABLED ou pagamento de teste): ingresso %s",
                ingresso.id,
            )
        else:
            refund = stripe.Refund.create(
                payment_intent=ingresso.stripe_payment_intent_id,
                reason="requested_by_customer",
                idempotency_key=f"refund_{ingresso.id}",
            )
            refund_id = refund.id

        if cancelamento_existente:
            cancelamento = cancelamento_existente
            cancelamento.valor_reembolso = ingresso.valor
            cancelamento.status = "processado"
            cancelamento.stripe_refund_id = refund_id
            cancelamento.data_processamento = agora
        else:
            cancelamento = Cancelamento(
                ingresso_id=ingresso.id,
                valor_reembolso=ingresso.valor,
                status="processado",
                stripe_refund_id=refund_id,
                data_processamento=agora,
            )

        ingresso.status = "cancelado"
        db.add(cancelamento)
        db.commit()

        return {
            "mensagem": "Ingresso cancelado com sucesso",
            "valor_reembolso": ingresso.valor,
            "refund_id": refund_id,
        }

    except stripe.error.StripeError as e:
        logger.exception("Erro Stripe ao processar reembolso")
        raise HTTPException(status_code=400, detail=REEMBOLSO_CLIENTE) from e
