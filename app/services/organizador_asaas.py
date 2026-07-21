"""Onboarding Asaas do organizador: wallet, subconta e antecipação."""

from __future__ import annotations

import json
import logging
import re
from datetime import datetime, timezone
from typing import Any

from sqlalchemy.orm import Session

from app.models import Evento, Ingresso, Usuario
from app.services.asaas_client import AsaasAPIError, AsaasClient, get_asaas_client
from app.services.evento_repasse import (
    agora_utc_naive,
    repasse_status_aprovado,
    serializar_detalhes_repasse,
)
from app.services.tarifas_plataforma import tarifa_para_organizador, taxa_ingresso
from app.utils.cpf import normalizar_cpf
from app.utils.secret_storage import decrypt_at_rest, encrypt_at_rest
from config.settings import settings

logger = logging.getLogger(__name__)

_WALLET_RE = re.compile(r"^[a-f0-9\-]{8,64}$", re.I)
# Taxa ilustrativa antecipação automática (Asaas — uso interno)
_TAXA_ANTECIPACAO_CARTAO_MES = 0.0125
_TAXA_ANTECIPACAO_PARCELADO_MES = 0.0170


def _digits(s: str | None, max_len: int) -> str:
    return re.sub(r"\D", "", s or "")[:max_len]


def _normalizar_status_asaas(general: str | None) -> str:
    g = (general or "PENDING").strip().upper()
    if g == "APPROVED":
        return "approved"
    if g == "REJECTED":
        return "rejected"
    if g == "AWAITING_APPROVAL":
        return "awaiting_approval"
    return "pending"


def _rotulo_status_repasse(status: str | None) -> str:
    s = (status or "").lower()
    return {
        "approved": "Conta aprovada",
        "linked": "Conta vinculada",
        "manual": "Conta configurada",
        "awaiting_approval": "Em análise",
        "rejected": "Conta reprovada",
        "pending": "Aguardando validação",
    }.get(s, "Não configurada")


def _passos_acompanhamento(status: str | None, detalhes: dict | None) -> list[dict[str, Any]]:
    det = detalhes or {}
    geral = (det.get("general") or status or "pending").upper()
    passos = [
        {"id": "envio", "titulo": "Dados enviados", "concluido": bool(status)},
        {
            "id": "validacao",
            "titulo": "Validação cadastral",
            "concluido": geral in ("APPROVED", "AWAITING_APPROVAL"),
            "ativo": geral in ("PENDING", "AWAITING_APPROVAL"),
        },
        {
            "id": "aprovacao",
            "titulo": "Conta liberada para vendas",
            "concluido": geral == "APPROVED" or status in ("approved", "manual", "linked"),
            "ativo": geral == "AWAITING_APPROVAL",
        },
    ]
    if (status or "").lower() == "rejected":
        passos.append(
            {
                "id": "rejeitada",
                "titulo": "Conta reprovada — revise os dados ou contate o suporte",
                "concluido": False,
                "erro": True,
            }
        )
    return passos


def consultar_status_repasse_asaas(usuario: Usuario) -> dict[str, Any] | None:
    """Consulta GET /v3/myAccount/status com a chave da subconta."""
    sub_client = _client_subconta(usuario)
    if not sub_client or not sub_client.enabled:
        return None
    try:
        return sub_client.get("/v3/myAccount/status")
    except AsaasAPIError as e:
        logger.warning("Status repasse Asaas indisponível (%s): %s", usuario.email, e)
        return None


def atualizar_status_repasse_organizador(db: Session, usuario: Usuario) -> Usuario:
    agora = agora_utc_naive()
    status_local = (usuario.asaas_repasse_status or "").strip().lower()
    if (usuario.asaas_account_id or "").strip() and usuario.asaas_subaccount_api_key:
        remoto = consultar_status_repasse_asaas(usuario)
        if isinstance(remoto, dict):
            novo = _normalizar_status_asaas(remoto.get("general"))
            # Não sobrescreve reprovação local com poll remoto (reenvio explícito limpa antes)
            if status_local != "rejected" or novo == "approved":
                usuario.asaas_repasse_status = novo
            usuario.asaas_repasse_status_em = agora
            usuario.asaas_repasse_detalhes = serializar_detalhes_repasse(remoto)
    elif (usuario.asaas_wallet_id or "").strip() and not (usuario.asaas_account_id or "").strip():
        status_atual = (usuario.asaas_repasse_status or "").strip().lower()
        if status_atual not in ("rejected", "pending", "awaiting_approval"):
            if settings.permite_vinculo_wallet_organizador():
                usuario.asaas_repasse_status = "linked"
            elif settings.asaas_allow_manual_wallet:
                usuario.asaas_repasse_status = "manual"
        usuario.asaas_repasse_status_em = agora
    db.add(usuario)
    return usuario


def _client_subconta(usuario: Usuario) -> AsaasClient | None:
    key = decrypt_at_rest(usuario.asaas_subaccount_api_key)
    if not key:
        return None
    return AsaasClient(api_key=key)


def _resolver_wallet_conta_asaas(client: AsaasClient) -> str:
    """Obtém walletId da conta via /v3/myAccount ou fallback GET /v3/wallets/."""
    try:
        account = client.get("/v3/myAccount")
    except AsaasAPIError:
        account = {}
    if isinstance(account, dict):
        wallet = str(account.get("walletId") or "").strip()
        if wallet:
            return wallet
    try:
        wallets = client.get("/v3/wallets/")
        if isinstance(wallets, dict):
            items = wallets.get("data") or []
            if items and isinstance(items[0], dict):
                return str(items[0].get("id") or "").strip()
    except AsaasAPIError:
        pass
    return ""


def _rejeitar_wallet_plataforma(wallet_id: str, *, contexto: str = "walletId") -> None:
    platform = (settings.ASAAS_PLATFORM_WALLET_ID or "").strip()
    if platform and wallet_id.lower() == platform.lower():
        if contexto == "api_key":
            raise ValueError(
                "Esta chave de acesso pertence à conta da plataforma. "
                "Crie uma conta de recebimento separada para o organizador e use a chave dessa conta."
            )
        raise ValueError(
            "Este identificador é o da conta da plataforma. "
            "Informe o identificador da sua conta de recebimento como organizador."
        )


def consultar_wallet_organizador_por_api_key(api_key: str) -> dict[str, Any]:
    """Consulta walletId da conta de recebimento do organizador a partir da chave de acesso."""
    key = (api_key or "").strip()
    if not key:
        raise ValueError("Informe a chave de acesso da sua conta de recebimento.")
    org_client = AsaasClient(api_key=key)
    if not org_client.enabled:
        raise ValueError("Chave de acesso inválida ou vazia.")
    try:
        account = org_client.get("/v3/myAccount")
    except AsaasAPIError as e:
        raise ValueError(str(e) or "Não foi possível consultar a conta de recebimento.") from e
    wallet = _resolver_wallet_conta_asaas(org_client)
    if not wallet:
        raise ValueError(
            "Não foi possível obter o identificador desta conta de recebimento. "
            "Verifique a chave de acesso informada."
        )
    _rejeitar_wallet_plataforma(wallet, contexto="api_key")
    name = ""
    email = ""
    if isinstance(account, dict):
        name = (account.get("name") or account.get("company") or "").strip()
        email = (account.get("email") or "").strip()
    return {
        "wallet_id": wallet,
        "account_name": name or None,
        "account_email": email or None,
        "asaas_environment": settings.asaas_env(),
    }


def validar_wallet_repasse(
    wallet_id: str,
    *,
    api_key_organizador: str | None = None,
) -> dict[str, Any]:
    """Valida walletId antes de vincular conta (formato, ≠ plataforma, opcional API key)."""
    wid = (wallet_id or "").strip()
    if not _WALLET_RE.match(wid):
        raise ValueError("Identificador de conta inválido. Verifique os dados e tente novamente.")
    _rejeitar_wallet_plataforma(wid)
    verificado_api = False
    key = (api_key_organizador or "").strip()
    if key:
        org_client = AsaasClient(api_key=key)
        if not org_client.enabled:
            raise ValueError("Chave de acesso inválida ou vazia.")
        try:
            org_client.get("/v3/myAccount")
        except AsaasAPIError as e:
            raise ValueError(str(e) or "Não foi possível validar a conta de recebimento.") from e
        acc_wallet = _resolver_wallet_conta_asaas(org_client)
        if acc_wallet:
            _rejeitar_wallet_plataforma(acc_wallet, contexto="api_key")
        if acc_wallet and acc_wallet.lower() != wid.lower():
            raise ValueError(
                "O walletId não corresponde à chave API informada. "
                "O identificador deve pertencer à mesma conta da chave de acesso."
            )
        verificado_api = True
    return {"wallet_id": wid, "verificado_api": verificado_api}


def sincronizar_wallet_eventos_organizador(db: Session, usuario: Usuario) -> int:
    """Propaga wallet do organizador para eventos ainda sem repasse configurado."""
    wid = (usuario.asaas_wallet_id or "").strip()
    if not wid:
        return 0
    return (
        db.query(Evento)
        .filter(
            Evento.organizador_id == usuario.id,
            (Evento.asaas_wallet_id.is_(None)) | (Evento.asaas_wallet_id == ""),
        )
        .update({Evento.asaas_wallet_id: wid}, synchronize_session=False)
    )


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

    status_repasse = (usuario.asaas_repasse_status or "").strip().lower() or None
    detalhes: dict | None = None
    if usuario.asaas_repasse_detalhes:
        try:
            detalhes = json.loads(usuario.asaas_repasse_detalhes)
        except json.JSONDecodeError:
            detalhes = None
    aprovado = repasse_status_aprovado(status_repasse)

    return {
        "asaas_ativo": settings.use_asaas,
        "payments_disabled": settings.payments_disabled,
        "wallet_id": wallet,
        "wallet_configurado": bool(wallet),
        "account_id": (usuario.asaas_account_id or "").strip() or None,
        "tem_subconta": bool((usuario.asaas_account_id or "").strip()),
        "repasse_status": status_repasse,
        "repasse_status_rotulo": _rotulo_status_repasse(status_repasse),
        "repasse_aprovado": aprovado,
        "pode_reenviar_subconta": pode_reenviar_subconta(usuario),
        "repasses_prontos": bool(wallet) and aprovado and settings.use_asaas,
        "pode_publicar_eventos_pagos": aprovado and settings.use_asaas and not settings.payments_disabled,
        "eventos_sem_wallet": eventos_sem_wallet,
        "anticipacao": anticipacao,
        "onboarding_mode": settings.asaas_onboarding_mode,
        "asaas_environment": settings.asaas_env(),
        "permite_vinculo_wallet": settings.permite_vinculo_wallet_organizador(),
        "permite_subconta": settings.permite_subconta_baas(),
        "nota_wallet": (
            "Configure sua conta de recebimento em Financeiro para publicar eventos pagos e receber automaticamente."
            if not wallet
            else (
                "Sua conta de recebimento está em análise. Acompanhe o andamento em Financeiro."
                if status_repasse in ("pending", "awaiting_approval")
                else None
            )
        ),
    }


def acompanhamento_repasse_organizador(db: Session, usuario: Usuario) -> dict[str, Any]:
    usuario = atualizar_status_repasse_organizador(db, usuario)
    db.commit()
    db.refresh(usuario)
    status_repasse = (usuario.asaas_repasse_status or "").strip().lower() or None
    detalhes: dict | None = None
    if usuario.asaas_repasse_detalhes:
        try:
            detalhes = json.loads(usuario.asaas_repasse_detalhes)
        except json.JSONDecodeError:
            detalhes = None
    return {
        "repasse_status": status_repasse,
        "repasse_status_rotulo": _rotulo_status_repasse(status_repasse),
        "repasse_aprovado": repasse_status_aprovado(status_repasse),
        "pode_reenviar_subconta": pode_reenviar_subconta(usuario),
        "atualizado_em": usuario.asaas_repasse_status_em.isoformat() + "Z"
        if usuario.asaas_repasse_status_em
        else None,
        "detalhes": detalhes,
        "passos": _passos_acompanhamento(status_repasse, detalhes),
        "pode_publicar_eventos_pagos": repasse_status_aprovado(status_repasse)
        and settings.use_asaas
        and not settings.payments_disabled,
    }


def definir_wallet_organizador(
    db: Session,
    usuario: Usuario,
    wallet_id: str,
    *,
    sincronizar_eventos: bool = True,
    admin_override: bool = False,
    api_key_organizador: str | None = None,
) -> dict[str, Any]:
    validacao = validar_wallet_repasse(wallet_id, api_key_organizador=api_key_organizador)
    wid = validacao["wallet_id"]
    if not settings.use_asaas:
        raise ValueError("Pagamentos não estão ativos neste ambiente.")
    pode_vincular = (
        settings.permite_vinculo_wallet_organizador()
        or settings.asaas_allow_manual_wallet
        or admin_override
    )
    if not pode_vincular:
        raise ValueError(
            "O vínculo manual de conta de recebimento está desativado neste ambiente. "
            "Entre em contato com o suporte da plataforma."
        )
    if (usuario.asaas_account_id or "").strip() and settings.permite_subconta_baas():
        raise ValueError(
            "Você já possui subconta criada pela plataforma. "
            "Use o acompanhamento da conta ou contate o suporte para alterar o modo de repasse."
        )

    novo_status = "linked" if settings.permite_vinculo_wallet_organizador() else "manual"
    usuario.asaas_wallet_id = wid
    usuario.asaas_repasse_status = novo_status
    usuario.asaas_repasse_status_em = agora_utc_naive()
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
        "verificado_api": validacao.get("verificado_api", False),
        "mensagem": "Conta de recebimento vinculada. Novas vendas usarão split para esta carteira.",
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
    cidade: str | None = None,
    estado: str | None = None,
    company_type: str = "INDIVIDUAL",
    data_nascimento: str | None = None,
) -> dict[str, Any]:
    if usuario.tipo != "organizador":
        raise ValueError("Apenas organizadores podem criar subconta.")
    if not settings.permite_subconta_baas():
        raise ValueError(
            "A criação de conta de recebimento pela plataforma está desativada. "
            "Configure sua conta de recebimento em Financeiro."
        )
    if (usuario.asaas_account_id or "").strip():
        raise ValueError("Você já possui subconta de recebimento vinculada.")
    if not settings.use_asaas:
        raise ValueError("Pagamentos não estão ativos neste ambiente.")

    doc = _digits(cpf_cnpj, 14)
    if len(doc) not in (11, 14):
        raise ValueError("Informe CPF (11 dígitos) ou CNPJ (14 dígitos) válido.")
    if len(doc) == 11:
        birth = (data_nascimento or "").strip()
        if not birth:
            raise ValueError("É necessário informar a data de nascimento.")
        if len(birth) != 10 or birth[4] != "-" or birth[7] != "-":
            raise ValueError("Data de nascimento inválida (use AAAA-MM-DD).")
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
    if cidade and cidade.strip():
        payload["city"] = cidade.strip()[:80]
    if estado and estado.strip():
        payload["state"] = estado.strip()[:2].upper()
    if len(doc) == 11:
        payload["birthDate"] = (data_nascimento or "").strip()

    from app.services.asaas_webhooks_config import webhooks_payload_subconta

    webhooks = webhooks_payload_subconta()
    if webhooks:
        payload["webhooks"] = webhooks

    client = get_asaas_client()
    try:
        sub = client.post("/v3/accounts", json=payload)
    except AsaasAPIError as e:
        raise ValueError(str(e) or "Não foi possível criar a subconta de recebimento.") from e

    account_id = sub.get("id")
    wallet_id = sub.get("walletId")
    api_key = sub.get("apiKey")
    if not wallet_id:
        raise ValueError("Subconta criada, mas walletId não retornado. Contate o suporte.")

    usuario.asaas_account_id = account_id
    usuario.asaas_wallet_id = wallet_id
    usuario.asaas_repasse_cpf_cnpj = doc
    if api_key:
        usuario.asaas_subaccount_api_key = encrypt_at_rest(str(api_key))
    usuario.asaas_repasse_status = "pending"
    usuario.asaas_repasse_status_em = agora_utc_naive()
    usuario.asaas_repasse_detalhes = None
    db.add(usuario)
    db.query(Evento).filter(Evento.organizador_id == usuario.id).update(
        {Evento.asaas_wallet_id: wallet_id},
        synchronize_session=False,
    )
    db.commit()
    db.refresh(usuario)
    usuario = atualizar_status_repasse_organizador(db, usuario)
    db.commit()
    db.refresh(usuario)

    try:
        atualizar_antecipacao_cartao(db, usuario, habilitar=True)
    except ValueError:
        logger.info("Antecipação automática não ativada na subconta %s", usuario.email)

    aprovado = repasse_status_aprovado(usuario.asaas_repasse_status)
    return {
        "ok": True,
        "account_id": account_id,
        "wallet_id": wallet_id,
        "tem_api_key": bool(api_key),
        "repasse_status": usuario.asaas_repasse_status,
        "repasse_aprovado": aprovado,
        "redirecionar_acompanhamento": True,
        "mensagem": (
            "Conta de repasses criada e aprovada. Você já pode publicar eventos pagos."
            if aprovado
            else "Dados enviados. Acompanhe a aprovação da sua conta de repasses."
        ),
    }


def pode_reenviar_subconta(usuario: Usuario) -> bool:
    return (usuario.asaas_repasse_status or "").strip().lower() == "rejected"


def limpar_subconta_rejeitada(db: Session, usuario: Usuario) -> None:
    """Remove vínculo local de subconta reprovada para permitir novo envio ao Asaas."""
    if not pode_reenviar_subconta(usuario):
        raise ValueError(
            "Reenvio disponível apenas quando a conta de repasses foi reprovada."
        )
    usuario.asaas_account_id = None
    usuario.asaas_wallet_id = None
    usuario.asaas_repasse_cpf_cnpj = None
    usuario.asaas_subaccount_api_key = None
    usuario.asaas_repasse_status = None
    usuario.asaas_repasse_status_em = None
    usuario.asaas_repasse_detalhes = None
    db.add(usuario)
    db.query(Evento).filter(Evento.organizador_id == usuario.id).update(
        {Evento.asaas_wallet_id: None},
        synchronize_session=False,
    )


def aplicar_webhook_status_conta_asaas(
    db: Session,
    *,
    account_id: str,
    account_status: dict[str, Any],
    event_type: str | None = None,
) -> Usuario | None:
    """Atualiza status de repasse a partir de webhook ACCOUNT_STATUS_* do Asaas."""
    aid = (account_id or "").strip()
    if not aid:
        return None
    usuario = db.query(Usuario).filter(Usuario.asaas_account_id == aid).first()
    if not usuario:
        logger.warning("Webhook conta Asaas: account_id %s sem organizador vinculado", aid)
        return None

    general = account_status.get("general")
    status_atual = (usuario.asaas_repasse_status or "").lower()
    evento_rejeicao = bool(event_type and str(event_type).endswith("_REJECTED"))

    if evento_rejeicao:
        usuario.asaas_repasse_status = "rejected"
    elif general is not None:
        usuario.asaas_repasse_status = _normalizar_status_asaas(general)
    elif event_type:
        if event_type.endswith("_AWAITING_APPROVAL"):
            usuario.asaas_repasse_status = "awaiting_approval"
        elif event_type.endswith("_PENDING"):
            usuario.asaas_repasse_status = "pending"
        elif event_type.endswith("_APPROVED"):
            usuario.asaas_repasse_status = "approved"
    elif status_atual == "rejected":
        # Mantém reprovação local até reenvio explícito
        pass

    usuario.asaas_repasse_status_em = agora_utc_naive()
    usuario.asaas_repasse_detalhes = serializar_detalhes_repasse(account_status)
    db.add(usuario)
    logger.info(
        "Repasse %s atualizado via webhook (%s) → %s",
        usuario.email,
        event_type or "accountStatus",
        usuario.asaas_repasse_status,
    )
    return usuario


def sincronizar_repasses_pendentes(db: Session) -> int:
    """Poll GET /v3/myAccount/status para organizadores com subconta ainda não aprovada."""
    if not settings.use_asaas or settings.payments_disabled:
        return 0
    pendentes = (
        db.query(Usuario)
        .filter(
            Usuario.tipo == "organizador",
            Usuario.asaas_account_id.isnot(None),
            Usuario.asaas_account_id != "",
            Usuario.asaas_repasse_status.in_(("pending", "awaiting_approval", None)),
        )
        .all()
    )
    alterados = 0
    for org in pendentes:
        antes = (org.asaas_repasse_status or "").lower()
        atualizar_status_repasse_organizador(db, org)
        depois = (org.asaas_repasse_status or "").lower()
        if depois != antes:
            alterados += 1
    if alterados:
        db.commit()
    return alterados


def reenviar_subconta_organizador(
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
    cidade: str | None = None,
    estado: str | None = None,
    company_type: str = "INDIVIDUAL",
    data_nascimento: str | None = None,
) -> dict[str, Any]:
    limpar_subconta_rejeitada(db, usuario)
    db.commit()
    db.refresh(usuario)
    return criar_subconta_organizador(
        db,
        usuario,
        cpf_cnpj=cpf_cnpj,
        telefone=telefone,
        renda_mensal=renda_mensal,
        cep=cep,
        endereco=endereco,
        numero=numero,
        bairro=bairro,
        complemento=complemento,
        cidade=cidade,
        estado=estado,
        company_type=company_type,
        data_nascimento=data_nascimento,
    )


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
            "Configure sua conta de recebimento ou crie subconta aqui."
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
    tarifa = tarifa_para_organizador(usuario)
    taxa_plataforma = round(taxa_ingresso(valor, tarifa), 2)
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
                    "nota": "Simulação oficial com base em uma cobrança recente.",
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
            "Valores reais dependem da análise de crédito."
        ),
    }
