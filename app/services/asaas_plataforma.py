"""Verificações da conta mãe Asaas da plataforma (chave API global)."""

from __future__ import annotations

import logging
import re
from typing import Any

from app.services.asaas_client import AsaasAPIError, AsaasClient, get_asaas_client
from config.settings import settings

logger = logging.getLogger(__name__)

_MSG_ORGANIZADOR_CONTA_PENDENTE = (
    "Não é possível criar sua conta de recebimento no momento. "
    "A configuração de pagamentos da plataforma está pendente. "
    "Entre em contato com o suporte EventosBR."
)


def extrair_cpf_cnpj_conta(account: dict[str, Any]) -> str:
    raw = str(account.get("cpfCnpj") or account.get("cpf_cnpj") or "").strip()
    return re.sub(r"\D", "", raw)


def consultar_conta_plataforma() -> dict[str, Any] | None:
    """GET /v3/myAccount com a chave da plataforma."""
    if not settings.use_asaas:
        return None
    client = get_asaas_client()
    if not client.enabled:
        return None
    try:
        account = client.get("/v3/myAccount")
    except AsaasAPIError as e:
        logger.warning("Não foi possível consultar conta da plataforma: %s", e)
        return None
    return account if isinstance(account, dict) else None


def plataforma_pode_provisionar_contas() -> bool | None:
    """
    True se a conta mãe é PJ (CNPJ) e pode criar contas de recebimento via POST /v3/accounts.
    False se for PF (CPF). None se não foi possível verificar.
    """
    account = consultar_conta_plataforma()
    if not account:
        return None
    doc = extrair_cpf_cnpj_conta(account)
    if len(doc) == 14:
        return True
    if len(doc) == 11:
        return False
    return None


def assert_plataforma_pode_provisionar_contas() -> None:
    """Bloqueia criação quando a conta mãe da plataforma é PF (limitação do processador)."""
    if not settings.permite_subconta_baas():
        return
    resultado = plataforma_pode_provisionar_contas()
    if resultado is False:
        raise ValueError(_MSG_ORGANIZADOR_CONTA_PENDENTE)
