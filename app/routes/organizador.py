"""Ferramentas do organizador: comunicados em massa e conta Asaas."""

from __future__ import annotations

import logging
import re

from fastapi import APIRouter, Depends, HTTPException

from pydantic import BaseModel, Field, field_validator
from sqlalchemy.orm import Session, joinedload

from app.models import Evento, Ingresso, Usuario, get_db
from app.deps.platform_admin import optional_platform_admin
from app.routes.auth import get_usuario_atual
from app.services.organizador_asaas import (
    acompanhamento_repasse_organizador,
    atualizar_antecipacao_cartao,
    atualizar_status_repasse_organizador,
    consultar_wallet_organizador_por_api_key,
    criar_subconta_organizador,
    definir_wallet_organizador,
    reenviar_subconta_organizador,
    simular_antecipacao,
    sincronizar_wallet_eventos_organizador,
    status_asaas_organizador,
)
from app.services.ticket_email import enqueue_comunicado_evento
from config.settings import settings

logger = logging.getLogger(__name__)
router = APIRouter()


class ComunicadoRequest(BaseModel):
    evento_id: str
    assunto: str = Field(min_length=3, max_length=200)
    mensagem: str = Field(min_length=10, max_length=8000)


def _require_organizador(usuario: Usuario) -> None:
    if usuario.tipo != "organizador":
        raise HTTPException(status_code=403, detail="Apenas organizadores podem enviar comunicados")


@router.post("/comunicados")
async def enviar_comunicado(
    body: ComunicadoRequest,
    usuario_atual: Usuario = Depends(get_usuario_atual),
    db: Session = Depends(get_db),
):
    """Envia e-mail para participantes com ingresso pago ou já utilizado."""
    _require_organizador(usuario_atual)

    evento = db.get(Evento, body.evento_id)
    if not evento or evento.organizador_id != usuario_atual.id:
        raise HTTPException(status_code=404, detail="Evento não encontrado")

    ingressos = (
        db.query(Ingresso)
        .options(joinedload(Ingresso.evento))
        .filter(
            Ingresso.evento_id == evento.id,
            Ingresso.status.in_(("pago", "usado")),
        )
        .all()
    )
    destinos = {
        (ing.participante_email or "").strip().lower()
        for ing in ingressos
        if (ing.participante_email or "").strip()
    }
    if not destinos:
        raise HTTPException(
            status_code=400,
            detail="Não há participantes com e-mail para este evento (ingressos pagos).",
        )

    enfileirados = enqueue_comunicado_evento(
        evento.id,
        body.assunto.strip(),
        body.mensagem.strip(),
    )
    logger.info(
        "Comunicado evento %s: %s destinos, fila=%s",
        evento.id,
        len(destinos),
        enfileirados,
    )
    return {
        "ok": True,
        "destinatarios": len(destinos),
        "enfileirados": enfileirados,
        "mensagem": "Comunicado enfileirado para envio. Verifique SMTP se os e-mails não chegarem.",
    }


class AsaasWalletRequest(BaseModel):
    wallet_id: str = Field(min_length=8, max_length=64)
    sincronizar_eventos: bool = True
    api_key: str | None = Field(
        default=None,
        max_length=512,
        description="Opcional: chave API Asaas do organizador para validar que o walletId pertence à conta.",
    )


class AsaasWalletConsultaRequest(BaseModel):
    api_key: str = Field(min_length=8, max_length=512)


class AsaasSubcontaRequest(BaseModel):
    cpf_cnpj: str = Field(min_length=11, max_length=18)
    telefone: str = Field(min_length=10, max_length=20)
    renda_mensal: float = Field(gt=0, le=10_000_000)
    cep: str = Field(min_length=8, max_length=10)
    endereco: str = Field(min_length=3, max_length=120)
    numero: str = Field(min_length=1, max_length=20)
    bairro: str = Field(min_length=2, max_length=80)
    complemento: str | None = Field(default=None, max_length=80)
    company_type: str = Field(default="INDIVIDUAL", max_length=20)
    data_nascimento: str | None = Field(default=None, max_length=10)

    @field_validator("data_nascimento")
    @classmethod
    def validar_data_nascimento(cls, v: str | None) -> str | None:
        if v is None or not str(v).strip():
            return None
        d = str(v).strip()
        if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", d):
            raise ValueError("data_nascimento deve estar no formato AAAA-MM-DD")
        return d


class AsaasAntecipacaoRequest(BaseModel):
    credit_card_automatic_enabled: bool


class AsaasSimularAntecipacaoRequest(BaseModel):
    valor_reais: float = Field(gt=0, le=1_000_000)
    payment_id: str | None = Field(default=None, max_length=64)


@router.get("/asaas")
async def asaas_status_organizador(
    usuario_atual: Usuario = Depends(get_usuario_atual),
    db: Session = Depends(get_db),
):
    _require_organizador(usuario_atual)
    atualizados = sincronizar_wallet_eventos_organizador(db, usuario_atual)
    if atualizados:
        db.commit()
    usuario_atual = atualizar_status_repasse_organizador(db, usuario_atual)
    db.commit()
    db.refresh(usuario_atual)
    return status_asaas_organizador(db, usuario_atual)


@router.get("/asaas/acompanhamento")
async def asaas_acompanhamento_repasse(
    usuario_atual: Usuario = Depends(get_usuario_atual),
    db: Session = Depends(get_db),
):
    _require_organizador(usuario_atual)
    return acompanhamento_repasse_organizador(db, usuario_atual)


@router.put("/asaas/wallet")
async def asaas_definir_wallet(
    body: AsaasWalletRequest,
    usuario_atual: Usuario = Depends(get_usuario_atual),
    db: Session = Depends(get_db),
    admin_override: bool = Depends(optional_platform_admin),
):
    _require_organizador(usuario_atual)
    if settings.payments_disabled:
        raise HTTPException(status_code=503, detail="Pagamentos desativados neste ambiente.")
    if not settings.use_asaas:
        raise HTTPException(status_code=503, detail="Asaas não está ativo neste ambiente.")
    pode_vincular = (
        settings.permite_vinculo_wallet_organizador()
        or settings.asaas_allow_manual_wallet
        or admin_override
    )
    if not pode_vincular:
        raise HTTPException(
            status_code=403,
            detail=(
                "O vínculo de conta Asaas está desativado neste ambiente. "
                "Entre em contato com o suporte da plataforma."
            ),
        )
    try:
        return definir_wallet_organizador(
            db,
            usuario_atual,
            body.wallet_id,
            sincronizar_eventos=body.sincronizar_eventos,
            admin_override=admin_override,
            api_key_organizador=body.api_key,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e


@router.post("/asaas/wallet/consultar")
async def asaas_consultar_wallet(
    body: AsaasWalletConsultaRequest,
    usuario_atual: Usuario = Depends(get_usuario_atual),
):
    _require_organizador(usuario_atual)
    if settings.payments_disabled:
        raise HTTPException(status_code=503, detail="Pagamentos desativados neste ambiente.")
    if not settings.use_asaas:
        raise HTTPException(status_code=503, detail="Asaas não está ativo neste ambiente.")
    if not settings.permite_vinculo_wallet_organizador() and not settings.asaas_allow_manual_wallet:
        raise HTTPException(
            status_code=403,
            detail="O vínculo de conta Asaas está desativado neste ambiente.",
        )
    try:
        return consultar_wallet_organizador_por_api_key(body.api_key)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e


@router.post("/asaas/subconta")
async def asaas_criar_subconta(
    body: AsaasSubcontaRequest,
    usuario_atual: Usuario = Depends(get_usuario_atual),
    db: Session = Depends(get_db),
):
    _require_organizador(usuario_atual)
    if settings.payments_disabled:
        raise HTTPException(status_code=503, detail="Pagamentos desativados neste ambiente.")
    try:
        return criar_subconta_organizador(
            db,
            usuario_atual,
            cpf_cnpj=body.cpf_cnpj,
            telefone=body.telefone,
            renda_mensal=body.renda_mensal,
            cep=body.cep,
            endereco=body.endereco,
            numero=body.numero,
            bairro=body.bairro,
            complemento=body.complemento,
            company_type=body.company_type,
            data_nascimento=body.data_nascimento,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e


@router.post("/asaas/subconta/reenviar")
async def asaas_reenviar_subconta(
    body: AsaasSubcontaRequest,
    usuario_atual: Usuario = Depends(get_usuario_atual),
    db: Session = Depends(get_db),
):
    """Reenvia dados ao Asaas após reprovação da subconta (KYC)."""
    _require_organizador(usuario_atual)
    if settings.payments_disabled:
        raise HTTPException(status_code=503, detail="Pagamentos desativados neste ambiente.")
    try:
        return reenviar_subconta_organizador(
            db,
            usuario_atual,
            cpf_cnpj=body.cpf_cnpj,
            telefone=body.telefone,
            renda_mensal=body.renda_mensal,
            cep=body.cep,
            endereco=body.endereco,
            numero=body.numero,
            bairro=body.bairro,
            complemento=body.complemento,
            company_type=body.company_type,
            data_nascimento=body.data_nascimento,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e


@router.put("/asaas/antecipacao")
async def asaas_antecipacao(
    body: AsaasAntecipacaoRequest,
    usuario_atual: Usuario = Depends(get_usuario_atual),
    db: Session = Depends(get_db),
):
    _require_organizador(usuario_atual)
    try:
        return atualizar_antecipacao_cartao(
            db,
            usuario_atual,
            habilitar=body.credit_card_automatic_enabled,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e


@router.post("/asaas/antecipacao/simular")
async def asaas_simular_antecipacao(
    body: AsaasSimularAntecipacaoRequest,
    usuario_atual: Usuario = Depends(get_usuario_atual),
    db: Session = Depends(get_db),
):
    _require_organizador(usuario_atual)
    try:
        return simular_antecipacao(
            db,
            usuario_atual,
            valor_reais=body.valor_reais,
            payment_id=body.payment_id,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e


@router.get("/assinatura")
async def obter_assinatura(
    usuario_atual: Usuario = Depends(get_usuario_atual),
    db: Session = Depends(get_db),
):
    """Status da assinatura mensal (taxa reduzida por ingresso)."""
    _require_organizador(usuario_atual)
    from app.services.assinatura_organizador import sincronizar_assinatura_pendente, status_assinatura

    if (usuario_atual.assinatura_renovacao_payment_id or "").strip():
        sincronizar_assinatura_pendente(db, usuario_atual)
        db.refresh(usuario_atual)
    return status_assinatura(usuario_atual)


@router.post("/assinatura/sincronizar")
async def sincronizar_assinatura(
    usuario_atual: Usuario = Depends(get_usuario_atual),
    db: Session = Depends(get_db),
):
    _require_organizador(usuario_atual)
    from app.services.assinatura_organizador import sincronizar_assinatura_pendente

    return sincronizar_assinatura_pendente(db, usuario_atual)


@router.post("/assinatura/pagar")
async def pagar_assinatura(
    usuario_atual: Usuario = Depends(get_usuario_atual),
    db: Session = Depends(get_db),
):
    """Gera cobrança PIX da mensalidade EventosBR."""
    _require_organizador(usuario_atual)
    from app.services.assinatura_organizador import iniciar_cobranca_assinatura

    try:
        return iniciar_cobranca_assinatura(db, usuario_atual)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
