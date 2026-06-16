"""Onboarding Asaas do organizador: wallet, subconta e antecipação."""

from __future__ import annotations

import logging
import re
from typing import Any

from sqlalchemy.orm import Session

from app.models import Evento, Ingresso, Usuario
from app.services.asaas_client import AsaasAPIError, AsaasClient, get_asaas_client
from app.services.tarifas_plataforma import taxa_ingresso
from app.utils.cpf import normalizar_cpf
from config.settings import settings

logger = logging.getLogger(__name__)

_WALLET_RE = re.compile(r"^[a-f0-9\-]{8,64}$", re.I)
# Taxa ilustrativa cartão (antecipação automática Asaas — consulte contrato)
_TAXA_ANTECIPACAO_CARTAO_MES = 0.0125


def _digits(s: str | None, max_len: int) -> str:
    return re.sub(r"\D", "", s or "")[:max_len]


def _client_subconta(usuario: Usuario) -> AsaasClient | None:
    key = (usuario.asaas_subaccount_api_key or "").strip()
    if not key:
        return None
    return AsaasClient(api_key=key)


def status_asaas_organizador(db: Session, usuario: Usuario) -> dict[str, Any]:
    wallet = (usuario.asaas_wallet_id or "").strip() or None
    eventos_sem_wallet = (
        db.query(Evento)
        .filter(
            Evento.organizador_id == usuario.id,
            (Evento.asaas_wallet_id.is_(None)) | (Evento.asaas_wallet_id == ""),
        )
        .count()
    )
    anticipacao: dict[str, Any] = {
        "disponivel": False,
        "credit_card_automatic_enabled": usuario.asaas_anticipacao_cartao,
    }
    sub_client = _client_subconta(usuario)
    if sub_client and sub_client.enabled:
        anticipacao["disponivel"] = True
        try:
            cfg = sub_client.get("/v3/anticipations/configurations")
            if isinstance(cfg, dict) and "creditCardAutomaticEnabled" in cfg:
                anticipacao["credit_card_automatic_enabled"] = bool(
                    cfg.get("creditCardAutomaticEnabled")
                )
        except AsaasAPIError as e:
            logger.warning("Não foi possível ler antecipação Asaas (%s): %s", usuario.email, e)

    return {
        "asaas_ativo": settings.use_asaas,
        "payments_disabled": settings.payments_disabled,
        "wallet_id": wallet,
        "wallet_configurado": bool(wallet),
        "account_id": (usuario.asaas_account_id or "").strip() or None,
        "tem_subconta": bool((usuario.asaas_account_id or "").strip()),
        "repasses_prontos": bool(wallet) and settings.use_asaas,
        "eventos_sem_wallet": eventos_sem_wallet,
        "anticipacao": anticipacao,
        "nota_wallet": (
            "Informe o walletId da sua conta Asaas para receber repasses via split. "
            "Encontre em Asaas → Minha conta → Integrações."
            if not wallet
            else None
        ),
    }


def definir_wallet_organizador(
    db: Session,
    usuario: Usuario,
    wallet_id: str,
    *,
    sincronizar_eventos: bool = True,
) -> dict[str, Any]:
    wid = (wallet_id or "").strip()
    if not _WALLET_RE.match(wid):
        raise ValueError("walletId inválido. Cole o identificador completo da conta Asaas.")
    if not settings.use_asaas:
        raise ValueError("Asaas não está ativo neste ambiente.")

    usuario.asaas_wallet_id = wid
    db.add(usuario)
    atualizados = 0
    if sincronizar_eventos:
        atualizados = (
            db.query(Evento)
            .filter(Evento.organizador_id == usuario.id)
            .update({Evento.asaas_wallet_id: wid}, synchronize_session=False)
        )
    db.commit()
    db.refresh(usuario)
    return {
        "ok": True,
        "wallet_id": wid,
        "eventos_atualizados": atualizados,
        "mensagem": "Conta de repasse configurada. Novas vendas usarão split para esta carteira.",
    }


def criar_subconta_organizador(
    db: Session,
    usuario: Usuario,
    *,
    cpf_cnpj: str,
    telefone: str,
    renda_mensal: float,
    cep: str,
    endereco: str,
    numero: str,
    bairro: str,
    complemento: str | None = None,
    company_type: str = "INDIVIDUAL",
) -> dict[str, Any]:
    if usuario.tipo != "organizador":
        raise ValueError("Apenas organizadores podem criar subconta.")
    if (usuario.asaas_account_id or "").strip():
        raise ValueError("Você já possui subconta Asaas vinculada.")
    if not settings.use_asaas:
        raise ValueError("Asaas não está ativo neste ambiente.")

    doc = _digits(cpf_cnpj, 14)
    if len(doc) not in (11, 14):
        raise ValueError("Informe CPF (11 dígitos) ou CNPJ (14 dígitos) válido.")
    mobile = _digits(telefone, 11)
    if len(mobile) < 10:
        raise ValueError("Telefone inválido (DDD + número).")
    cep_limpo = _digits(cep, 8)
    if len(cep_limpo) != 8:
        raise ValueError("CEP inválido.")

    payload: dict[str, Any] = {
        "name": (usuario.nome or "Organizador")[:100],
        "email": usuario.email[:255],
        "cpfCnpj": doc,
        "mobilePhone": mobile,
        "incomeValue": round(max(renda_mensal, 0.0), 2),
        "address": endereco.strip()[:120],
        "addressNumber": numero.strip()[:20],
        "province": bairro.strip()[:80],
        "postalCode": cep_limpo,
        "companyType": company_type.strip().upper() or "INDIVIDUAL",
    }
    if complemento and complemento.strip():
        payload["complement"] = complemento.strip()[:80]

    client = get_asaas_client()
    try:
        sub = client.post("/v3/accounts", json=payload)
    except AsaasAPIError as e:
        raise ValueError(str(e) or "Não foi possível criar subconta no Asaas.") from e

    account_id = sub.get("id")
    wallet_id = sub.get("walletId")
    api_key = sub.get("apiKey")
    if not wallet_id:
        raise ValueError("Subconta criada, mas walletId não retornado. Contate o suporte.")

    usuario.asaas_account_id = account_id
    usuario.asaas_wallet_id = wallet_id
    if api_key:
        usuario.asaas_subaccount_api_key = str(api_key)
    db.add(usuario)
    db.query(Evento).filter(Evento.organizador_id == usuario.id).update(
        {Evento.asaas_wallet_id: wallet_id},
        synchronize_session=False,
    )
    db.commit()
    db.refresh(usuario)

    return {
        "ok": True,
        "account_id": account_id,
        "wallet_id": wallet_id,
        "tem_api_key": bool(api_key),
        "mensagem": "Subconta criada. Repasses e antecipação já podem ser configurados.",
    }


def atualizar_antecipacao_cartao(
    db: Session,
    usuario: Usuario,
    *,
    habilitar: bool,
) -> dict[str, Any]:
    sub_client = _client_subconta(usuario)
    if not sub_client or not sub_client.enabled:
        raise ValueError(
            "Antecipação automática exige subconta criada pela plataforma. "
            "Configure no painel Asaas ou crie subconta aqui."
        )
    try:
        cfg = sub_client.put(
            "/v3/anticipations/configurations",
            json={"creditCardAutomaticEnabled": bool(habilitar)},
        )
    except AsaasAPIError as e:
        raise ValueError(str(e) or "Não foi possível atualizar antecipação.") from e

    enabled = bool(cfg.get("creditCardAutomaticEnabled")) if isinstance(cfg, dict) else habilitar
    usuario.asaas_anticipacao_cartao = enabled
    db.add(usuario)
    db.commit()
    db.refresh(usuario)
    return {
        "ok": True,
        "credit_card_automatic_enabled": enabled,
        "mensagem": (
            "Antecipação automática no cartão ativada."
            if enabled
            else "Antecipação automática desativada."
        ),
    }


def simular_antecipacao(
    db: Session,
    usuario: Usuario,
    *,
    valor_reais: float,
    payment_id: str | None = None,
) -> dict[str, Any]:
    """Simula antecipação real (se houver cobrança) ou estimativa ilustrativa."""
    valor = round(max(0.01, valor_reais), 2)
    taxa_plataforma = round(taxa_ingresso(valor), 2)
    liquido_apos_taxa = round(max(0.0, valor - taxa_plataforma), 2)

    pay_id = (payment_id or "").strip()
    if not pay_id:
        ing = (
            db.query(Ingresso)
            .join(Evento, Ingresso.evento_id == Evento.id)
            .filter(
                Evento.organizador_id == usuario.id,
                Ingresso.status.in_(("pago", "usado")),
                Ingresso.asaas_payment_id.isnot(None),
                Ingresso.asaas_payment_id != "",
            )
            .order_by(Ingresso.data_compra.desc())
            .first()
        )
        if ing and ing.asaas_payment_id:
            pay_id = ing.asaas_payment_id.strip()

    sub_client = _client_subconta(usuario)
    if pay_id and sub_client and sub_client.enabled:
        try:
            sim = sub_client.post("/v3/anticipations/simulate", json={"payment": pay_id})
            if isinstance(sim, dict):
                return {
                    "modo": "asaas",
                    "payment_id": pay_id,
                    "valor_bruto": valor,
                    "taxa_plataforma": taxa_plataforma,
                    "simulacao": sim,
                    "nota": "Simulação oficial Asaas com base em uma cobrança recente.",
                }
        except AsaasAPIError as e:
            logger.info("Simulação Asaas indisponível (%s), usando estimativa.", e)

    taxa_antecip = round(liquido_apos_taxa * _TAXA_ANTECIPACAO_CARTAO_MES, 2)
    liquido_antecipado = round(max(0.0, liquido_apos_taxa - taxa_antecip), 2)
    return {
        "modo": "estimativa",
        "valor_bruto": valor,
        "taxa_plataforma": taxa_plataforma,
        "liquido_apos_taxa": liquido_apos_taxa,
        "taxa_antecipacao_estimada": taxa_antecip,
        "liquido_antecipado_estimado": liquido_antecipado,
        "taxa_antecipacao_mes_pct": _TAXA_ANTECIPACAO_CARTAO_MES * 100,
        "nota": (
            "Estimativa ilustrativa (cartão ~1,25% a.m.). "
            "Valores reais dependem do Asaas e análise de crédito."
        ),
    }
