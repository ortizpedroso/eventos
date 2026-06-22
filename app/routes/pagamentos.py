import logging
import uuid
from datetime import datetime, timedelta, timezone

from email_validator import EmailNotValidError, validate_email
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel, Field, field_validator
from sqlalchemy.orm import Session

from app.models import Usuario, Evento, Ingresso, Cancelamento, get_db
from app.deps.rate_limit import rate_limit_checkout
from app.routes.auth import get_usuario_atual
from app.services.cpf_limite import validar_limite_cpf_evento
from app.services.cupom_desconto import centavos_com_cupom, resolver_cupom_evento
from app.services.evento_repasse import MOTIVO_CHECKOUT_SEM_REPASSE, garantir_wallet_repasse_evento
from app.services.ingresso_lotes import (
    motivo_lote_indisponivel,
    reservar_vaga_lote,
    resolver_lote_compra,
    resolver_lote_por_id,
)
from app.services.ingresso_pago import marcar_ingresso_pago, notificar_ingresso_pago
from app.services.pagamentos_asaas_handlers import (
    AsaasCobrancaRequest,
    cancelar_com_reembolso_asaas,
    criar_resposta_asaas_apos_criar,
    iniciar_cobranca_asaas,
    retomar_pagamento_asaas,
    status_cobranca_asaas,
)
from app.services.ticket_email import enqueue_ticket_email
from app.services.taxas_asaas_publicas import INGRESSO_MINIMO_PAGO_REAIS
from app.utils.cpf import cpf_valido, normalizar_cpf
from app.utils.ingresso_tipos import lote_e_cortesia
from app.utils.privacy import mask_cpf, mask_telefone_br
from app.utils.public_errors import PAGAMENTO_CLIENTE, REEMBOLSO_CLIENTE
from config.settings import settings

logger = logging.getLogger(__name__)
router = APIRouter()

_RESERVA_MINUTOS = 35
class CriarPagamentoRequest(BaseModel):
    evento_id: str
    lote_id: str | None = Field(default=None, max_length=64)
    quantidade: int = Field(default=1, ge=1, le=10)
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
    termo_compra_aceito: bool = Field(default=False)
    termo_compra_versao: str | None = Field(default=None, max_length=32)
    token_espera: str | None = Field(default=None, max_length=128)

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


class RetomarPagamentoRequest(BaseModel):
    ingresso_id: str
    evento_id: str | None = None
    token_espera: str | None = Field(default=None, max_length=128)


class ValidarCupomRequest(BaseModel):
    evento_id: str
    codigo_cupom: str = Field(min_length=3, max_length=40)
    lote_id: str | None = Field(default=None, max_length=64)
    quantidade: int = Field(default=1, ge=1, le=10)


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

    lote_id_req = (body.lote_id or "").strip() or None
    if lote_id_req:
        lote = resolver_lote_por_id(db, evento, lote_id_req)
    else:
        lote = resolver_lote_compra(db, evento)
    if lote is None:
        raise HTTPException(status_code=400, detail=motivo_lote_indisponivel(db, evento))

    quantidade = int(body.quantidade or 1)
    eh_cortesia = lote_e_cortesia(getattr(lote, "tipo", None)) or float(lote.preco or 0) <= 0
    if eh_cortesia:
        raise HTTPException(status_code=400, detail="Cupom não se aplica a ingresso cortesia.")

    unit_centavos = int(round(float(lote.preco) * 100))
    base_centavos = unit_centavos * quantidade
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

    if not body.termo_compra_aceito:
        raise HTTPException(
            status_code=400,
            detail="É necessário aceitar o termo de responsabilidade para continuar a compra.",
        )
    termo_aceite_em = datetime.now(timezone.utc).replace(tzinfo=None)
    termo_versao = (body.termo_compra_versao or "").strip() or "2026-05-v1"

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

    from app.services.lista_espera import validar_compra_com_token_espera

    validar_compra_com_token_espera(db, evento, body.token_espera, pe)

    quantidade = int(body.quantidade or 1)

    lote_id_req = (body.lote_id or "").strip() or None
    if lote_id_req:
        lote = resolver_lote_por_id(db, evento, lote_id_req)
        if lote is None:
            raise HTTPException(
                status_code=400,
                detail="Lote indisponível ou esgotado. Escolha outro lote ou recarregue a página.",
            )
    else:
        lote = resolver_lote_compra(db, evento)
        if lote is None:
            raise HTTPException(
                status_code=400,
                detail=motivo_lote_indisponivel(db, evento),
            )

    eh_cortesia = lote_e_cortesia(getattr(lote, "tipo", None)) or float(lote.preco or 0) <= 0
    unit_centavos = 0 if eh_cortesia else int(round(float(lote.preco) * 100))
    unit_reais = unit_centavos / 100
    cupom_id: str | None = None
    codigo_cupom = (body.codigo_cupom or "").strip()
    if codigo_cupom and not eh_cortesia:
        try:
            cupom = resolver_cupom_evento(db, evento.id, codigo_cupom)
            unit_centavos = centavos_com_cupom(unit_centavos, cupom)
            cupom_id = cupom.id
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e)) from e
    elif codigo_cupom and eh_cortesia:
        raise HTTPException(status_code=400, detail="Cupom não se aplica a ingresso cortesia.")

    valor_centavos = unit_centavos * quantidade
    valor_reais = valor_centavos / 100
    if body.valor_centavos is not None and int(body.valor_centavos) != valor_centavos:
        raise HTTPException(
            status_code=400,
            detail=f"Valor incorreto para o lote atual ({lote.nome}). Recarregue a página e tente novamente.",
        )
    if not eh_cortesia and unit_centavos < int(INGRESSO_MINIMO_PAGO_REAIS * 100):
        raise HTTPException(
            status_code=400,
            detail=f"Valor mínimo de R$ {INGRESSO_MINIMO_PAGO_REAIS:.2f} para ingressos pagos.",
        )

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
            validar_limite_cpf_evento(db, evento, cpf_limite or "", incremento=quantidade)
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e)) from e

    resp_cortesia = (body.cortesia_responsavel or "").strip() or None
    if eh_cortesia and not resp_cortesia:
        resp_cortesia = "Ingresso cortesia"

    def _ingressos_gratis(fake_prefix: str = "cortesia") -> dict:
        agora = datetime.now(timezone.utc).replace(tzinfo=None)
        ids: list[str] = []
        for _ in range(quantidade):
            fake_ref = f"{fake_prefix}_{uuid.uuid4().hex}"
            novo = Ingresso(
                evento_id=evento.id,
                usuario_id=usuario_atual.id,
                lote_id=lote.id,
                participante_nome=pn,
                participante_email=pe,
                participante_cpf=p_cpf,
                participante_telefone=p_tel,
                cortesia_responsavel=resp_cortesia if eh_cortesia else None,
                termo_compra_aceito_em=termo_aceite_em,
                termo_compra_versao=termo_versao,
                valor=unit_reais,
                asaas_payment_id=fake_ref,
                status="pago",
                data_compra=agora,
                data_limite_cancelamento=agora + timedelta(days=10),
            )
            db.add(novo)
            db.flush()
            ids.append(novo.id)
        if pe:
            from app.services.lista_espera import marcar_espera_comprada

            marcar_espera_comprada(db, evento.id, pe)
        db.commit()
        for iid in ids:
            enqueue_ticket_email(iid)
        resp: dict = {
            "client_secret": "",
            "ingresso_id": ids[0],
            "ingresso_ids": ids,
            "quantidade": quantidade,
            "cortesia": eh_cortesia,
        }
        if fake_prefix == "disabled":
            resp["payments_disabled"] = True
        return resp

    if eh_cortesia:
        logger.info(
            "Ingresso cortesia (R$ 0) evento %s lote %s x%d",
            evento.id,
            lote.id,
            quantidade,
        )
        return _ingressos_gratis("cortesia")

    logger.info(
        "Criando pagamento R$ %.2f (%d ingresso(s)) evento %s",
        valor_reais,
        quantidade,
        body.evento_id,
    )

    if settings.payments_disabled:
        if not settings.permite_ingresso_sem_gateway:
            raise HTTPException(
                status_code=503,
                detail="Pagamentos temporariamente indisponíveis. Tente novamente mais tarde.",
            )
        logger.warning("Pagamentos desativados: ingresso pago sem gateway evento %s", evento.id)
        return _ingressos_gratis("disabled")

    if not garantir_wallet_repasse_evento(db, evento):
        raise HTTPException(
            status_code=400,
            detail=MOTIVO_CHECKOUT_SEM_REPASSE,
        )
    if not (settings.ASAAS_PLATFORM_WALLET_ID or "").strip():
        raise HTTPException(
            status_code=503,
            detail="Pagamentos temporariamente indisponíveis. Contate o suporte.",
        )

    # ── Reserva de vaga ───────────────────────────────────────────────────
    try:
        reservar_vaga_lote(db, lote.id, quantidade)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e

    agora = datetime.now(timezone.utc).replace(tzinfo=None)
    reserva_ate = agora + timedelta(minutes=_RESERVA_MINUTOS)
    novos: list[Ingresso] = []
    for _ in range(quantidade):
        ing = Ingresso(
            evento_id=evento.id,
            usuario_id=usuario_atual.id,
            lote_id=lote.id,
            participante_nome=pn,
            participante_email=pe,
            participante_cpf=p_cpf,
            participante_telefone=p_tel,
            cupom_id=cupom_id,
            cortesia_responsavel=resp_cortesia if eh_cortesia else None,
            valor=unit_reais,
            asaas_payment_id=None,
            status="pendente",
            reservado_ate=reserva_ate,
            termo_compra_aceito_em=termo_aceite_em,
            termo_compra_versao=termo_versao,
        )
        db.add(ing)
        novos.append(ing)
    db.commit()
    for ing in novos:
        db.refresh(ing)

    return criar_resposta_asaas_apos_criar(
        novos=novos,
        valor_centavos=valor_centavos,
        reserva_ate=reserva_ate,
        quantidade=quantidade,
    )

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
                "slug": ingresso.evento.slug,
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
            "reservado_ate": (
                ingresso.reservado_ate.isoformat() + "Z"
                if ingresso.reservado_ate is not None
                else None
            ),
        }
        for ingresso in ingressos
    ]


@router.post("/retomar")
async def retomar_pagamento(
    body: RetomarPagamentoRequest,
    usuario_atual: Usuario = Depends(get_usuario_atual),
    db: Session = Depends(get_db),
):
    """Retoma pagamento de ingresso pendente com reserva ainda válida."""
    ingresso = (
        db.query(Ingresso)
        .filter(
            Ingresso.id == body.ingresso_id,
            Ingresso.usuario_id == usuario_atual.id,
        )
        .first()
    )
    if not ingresso:
        raise HTTPException(status_code=404, detail="Ingresso não encontrado")

    if body.evento_id and ingresso.evento_id != body.evento_id:
        raise HTTPException(status_code=400, detail="Este ingresso pertence a outro evento.")

    if ingresso.status == "pago":
        return {
            "client_secret": "",
            "ingresso_id": ingresso.id,
            "ja_pago": True,
            "reservado_ate": None,
            "evento_slug": ingresso.evento.slug,
        }

    if ingresso.status != "pendente":
        raise HTTPException(
            status_code=400,
            detail="Este ingresso não está aguardando pagamento.",
        )

    agora = datetime.now(timezone.utc).replace(tzinfo=None)
    if ingresso.reservado_ate and ingresso.reservado_ate < agora:
        raise HTTPException(
            status_code=400,
            detail="A reserva expirou. Inicie uma nova compra no evento.",
        )

    from app.services.lista_espera import validar_espera_para_ingresso_pendente

    validar_espera_para_ingresso_pendente(db, ingresso, body.token_espera)

    if settings.payments_disabled:
        if not settings.permite_ingresso_sem_gateway:
            raise HTTPException(
                status_code=503,
                detail="Pagamentos temporariamente indisponíveis. Tente novamente mais tarde.",
            )
        marcar_ingresso_pago(db, ingresso)
        db.commit()
        notificar_ingresso_pago(ingresso.id)
        return {
            "client_secret": "",
            "ingresso_id": ingresso.id,
            "ja_pago": True,
            "payments_disabled": True,
            "payment_provider": "asaas",
            "reservado_ate": None,
            "evento_slug": ingresso.evento.slug,
        }
    return retomar_pagamento_asaas(db, ingresso)

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
            "refund_id": cancelamento_existente.asaas_refund_id,
            "idempotent": True,
        }
    
    if datetime.now(timezone.utc).replace(tzinfo=None) > ingresso.data_limite_cancelamento:
        raise HTTPException(status_code=400, detail="Prazo para cancelamento expirou")

    agora = datetime.now(timezone.utc).replace(tzinfo=None)
    skip_gateway_refund = settings.payments_disabled or (
        (ingresso.asaas_payment_id or "").startswith("disabled_")
    )

    try:
        if skip_gateway_refund:
            asaas_refund_id: str | None = None
            logger.warning(
                "Cancelamento sem reembolso no gateway (modo teste): ingresso %s",
                ingresso.id,
            )
        else:
            asaas_refund_id = cancelar_com_reembolso_asaas(db, ingresso)

        if cancelamento_existente:
            cancelamento = cancelamento_existente
            cancelamento.valor_reembolso = ingresso.valor
            cancelamento.status = "processado"
            cancelamento.asaas_refund_id = asaas_refund_id
            cancelamento.data_processamento = agora
        else:
            cancelamento = Cancelamento(
                ingresso_id=ingresso.id,
                valor_reembolso=ingresso.valor,
                status="processado",
                asaas_refund_id=asaas_refund_id,
                data_processamento=agora,
            )

        ingresso.status = "cancelado"
        db.add(cancelamento)
        db.flush()

        from app.services.lista_espera import liberar_vagas_apos_cancelamento

        liberar_vagas_apos_cancelamento(db, ingresso.evento_id, 1)
        db.commit()

        return {
            "mensagem": "Ingresso cancelado com sucesso",
            "valor_reembolso": ingresso.valor,
            "refund_id": asaas_refund_id,
        }

    except Exception as e:
        logger.exception("Erro ao processar reembolso")
        raise HTTPException(status_code=400, detail=REEMBOLSO_CLIENTE) from e


@router.get("/cotacao")
async def cotacao_pagamento(
    ingresso_id: str = Query(..., min_length=8),
    parcelas: int = Query(1, ge=1, le=21),
    usuario_atual: Usuario = Depends(get_usuario_atual),
    db: Session = Depends(get_db),
):
    """Breakdown all-in para o comprador (preço + parcelamento)."""
    from app.services.taxas_asaas_publicas import cotacao_checkout

    ingresso = db.get(Ingresso, ingresso_id)
    if not ingresso or ingresso.usuario_id != usuario_atual.id:
        raise HTTPException(status_code=404, detail="Ingresso não encontrado")
    evento = db.get(Evento, ingresso.evento_id)
    if not evento:
        raise HTTPException(status_code=404, detail="Evento não encontrado")

    valor_base = float(ingresso.valor or 0)
    comprador = cotacao_checkout(
        valor_base,
        parcelas=parcelas,
        repasse_parcelamento=getattr(evento, "repasse_parcelamento", "comprador") or "comprador",
    )
    return {
        "ingresso_id": ingresso.id,
        "evento_nome": evento.nome,
        "comprador": comprador,
    }


@router.post("/asaas/cobranca")
async def asaas_iniciar_cobranca(
    request: Request,
    body: AsaasCobrancaRequest,
    usuario_atual: Usuario = Depends(get_usuario_atual),
    db: Session = Depends(get_db),
    _rate: None = Depends(rate_limit_checkout),
):
    """Gera cobrança Asaas (PIX, cartão ou fatura) para ingresso reservado."""
    if not settings.use_asaas:
        raise HTTPException(status_code=400, detail="Provedor Asaas não está ativo.")
    from app.deps.rate_limit import client_ip_from_request

    if body.metodo == "card":
        body = body.model_copy(update={"remote_ip": client_ip_from_request(request)})
    return iniciar_cobranca_asaas(db, usuario_atual, body)


@router.get("/asaas/status/{ingresso_id}")
async def asaas_status_cobranca(
    ingresso_id: str,
    usuario_atual: Usuario = Depends(get_usuario_atual),
    db: Session = Depends(get_db),
):
    """Consulta status da cobrança Asaas (polling PIX)."""
    if not settings.use_asaas:
        raise HTTPException(status_code=400, detail="Provedor Asaas não está ativo.")
    return status_cobranca_asaas(db, ingresso_id, usuario_atual)
