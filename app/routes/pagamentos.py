import logging
import uuid
from datetime import datetime, timedelta, timezone

import stripe
from email_validator import EmailNotValidError, validate_email
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field, field_validator
from sqlalchemy.orm import Session

from app.models import Usuario, Evento, Ingresso, Cancelamento, get_db
from app.routes.auth import get_usuario_atual
from config.settings import settings

logger = logging.getLogger(__name__)
router = APIRouter()
stripe.api_key = settings.STRIPE_SECRET_KEY

class CriarPagamentoRequest(BaseModel):
    evento_id: str
    # Preferir sempre centavos (inteiro) para evitar erro de arredondamento.
    valor_centavos: int | None = Field(default=None, ge=50)  # >= R$0,50
    # Compatibilidade: aceita "valor" em reais (float) temporariamente.
    valor: float | None = Field(default=None, gt=0)
    # Quem vai ao evento (opcional: se omitido, usa o comprador = responsável financeiro).
    participante_nome: str | None = Field(default=None, max_length=200)
    participante_email: str | None = Field(default=None, max_length=255)

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

class CancelarIngressoRequest(BaseModel):
    ingresso_id: str

@router.post("/criar")
async def criar_pagamento(
    request: CriarPagamentoRequest,
    usuario_atual: Usuario = Depends(get_usuario_atual),
    db: Session = Depends(get_db)
):
    """Cria pagamento"""
    if request.valor_centavos is None and request.valor is None:
        raise HTTPException(status_code=400, detail="Informe valor_centavos (recomendado) ou valor")

    if request.valor_centavos is not None:
        valor_centavos = int(request.valor_centavos)
        valor_reais = valor_centavos / 100
    else:
        # float -> centavos (compatibilidade)
        valor_centavos = int(round(float(request.valor) * 100))
        valor_reais = float(request.valor)

    logger.info(f"Criando pagamento no valor de R$ {valor_reais:.2f} para evento {request.evento_id}")

    # Valida se o evento existe
    evento = db.query(Evento).filter(Evento.id == request.evento_id).first()
    if not evento:
        raise HTTPException(status_code=404, detail="Evento não encontrado")

    if not evento.publicado:
        raise HTTPException(
            status_code=403,
            detail="Evento pausado: não é possível comprar ingressos até ser republicado.",
        )

    pn = (request.participante_nome or "").strip() or None
    pe = (request.participante_email or "").strip() or None
    if (pn and not pe) or (pe and not pn):
        raise HTTPException(
            status_code=400,
            detail="Informe nome e e-mail do participante, ou deixe ambos em branco para usar os dados de quem paga.",
        )
    if not pn:
        pn = usuario_atual.nome
    if not pe:
        pe = usuario_atual.email

    try:
        validate_email(pe, check_deliverability=False)
    except EmailNotValidError:
        raise HTTPException(status_code=400, detail="E-mail do participante inválido")

    if settings.STRIPE_DISABLED:
        agora = datetime.now(timezone.utc).replace(tzinfo=None)
        fake_pi = f"disabled_{uuid.uuid4().hex}"
        novo_ingresso = Ingresso(
            evento_id=evento.id,
            usuario_id=usuario_atual.id,
            participante_nome=pn,
            participante_email=pe,
            valor=valor_reais,
            stripe_payment_intent_id=fake_pi,
            status="pago",
            data_compra=agora,
            data_limite_cancelamento=agora + timedelta(days=10),
        )
        db.add(novo_ingresso)
        db.commit()
        db.refresh(novo_ingresso)
        logger.warning(
            "STRIPE_DISABLED: ingresso %s registrado como pago sem Stripe (evento %s)",
            novo_ingresso.id,
            evento.id,
        )
        return {
            "client_secret": "",
            "ingresso_id": novo_ingresso.id,
            "stripe_disabled": True,
        }

    if not usuario_atual.stripe_customer_id:
        raise HTTPException(
            status_code=400,
            detail="Cliente Stripe não encontrado. Refaça o cadastro ou contate o suporte.",
        )

    try:
        # Cria o PaymentIntent no Stripe
        intent_params = {
            "amount": valor_centavos,
            "currency": "brl",
            "customer": usuario_atual.stripe_customer_id,
            "automatic_payment_methods": {"enabled": True},
            "metadata": {
                "evento_id": evento.id,
                "usuario_id": usuario_atual.id,
                "participante_nome": (pn or "")[:450],
                "participante_email": (pe or "")[:450],
            }
        }
        
        # Adiciona repasse (split) caso o organizador tenha conta Stripe cadastrada
        if evento.stripe_account_id:
            intent_params["transfer_data"] = {
                "destination": evento.stripe_account_id,
            }
            
        intent = stripe.PaymentIntent.create(**intent_params)

        # Cria o registro do Ingresso pendente no banco
        novo_ingresso = Ingresso(
            evento_id=evento.id,
            usuario_id=usuario_atual.id,
            participante_nome=pn,
            participante_email=pe,
            valor=valor_reais,
            stripe_payment_intent_id=intent.id,
            status="pendente",
        )
        db.add(novo_ingresso)
        db.commit()
        db.refresh(novo_ingresso)

        return {
            "client_secret": intent.client_secret,
            "ingresso_id": novo_ingresso.id
        }
        
    except stripe.error.StripeError as e:
        logger.error(f"Erro Stripe ao criar pagamento: {str(e)}")
        raise HTTPException(status_code=400, detail=f"Erro ao processar pagamento: {str(e)}")

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
        logger.error(f"Erro Stripe ao processar reembolso: {str(e)}")
        raise HTTPException(status_code=400, detail=f"Erro ao processar reembolso: {str(e)}")
