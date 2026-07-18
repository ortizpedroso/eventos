"""Cliente e subconta Asaas no cadastro de usuário."""

from __future__ import annotations

import logging
import re

from sqlalchemy.orm import Session

from app.models import Usuario
from app.services.asaas_client import AsaasAPIError, get_asaas_client
from config.settings import settings

logger = logging.getLogger(__name__)


def _digits(s: str | None, max_len: int) -> str:
    return re.sub(r"\D", "", s or "")[:max_len]


def criar_asaas_para_novo_usuario(
    *,
    email: str,
    nome: str,
    tipo: str,
    cpf_cnpj: str | None = None,
    telefone: str | None = None,
) -> tuple[str | None, str | None, str | None]:
    """Retorna (asaas_customer_id, asaas_wallet_id, asaas_account_id)."""
    if settings.ASAAS_DISABLED or not settings.use_asaas:
        logger.warning("Asaas desativado: usuário %s sem customer/subconta", email)
        return None, None, None

    client = get_asaas_client()
    if not client.enabled:
        return None, None, None

    doc = re.sub(r"\D", "", cpf_cnpj or "")
    mobile = _digits(telefone, 11)
    payload: dict = {"name": nome[:100], "email": email[:255]}
    if len(doc) in (11, 14):
        payload["cpfCnpj"] = doc
    if mobile:
        payload["mobilePhone"] = mobile

    try:
        customer = client.post("/v3/customers", json=payload)
    except AsaasAPIError:
        logger.exception("Erro ao criar customer Asaas para %s", email)
        raise

    customer_id = customer.get("id")
    wallet_id: str | None = None
    account_id: str | None = None

    if tipo == "organizador" and settings.ASAAS_CREATE_SUBACCOUNT_ON_REGISTER:
        try:
            sub_payload = {
                "name": nome[:100],
                "email": email[:255],
                "cpfCnpj": doc if len(doc) == 11 else "24971563792",
                "mobilePhone": mobile or "47999999999",
                "incomeValue": 5000,
                "address": "Rua Exemplo",
                "addressNumber": "100",
                "province": "Centro",
                "postalCode": "89010025",
            }
            sub = client.post("/v3/accounts", json=sub_payload)
            account_id = sub.get("id")
            wallet_id = sub.get("walletId")
        except AsaasAPIError as e:
            logger.warning(
                "Subconta Asaas não criada no cadastro (%s): %s — organizador pode informar wallet depois.",
                email,
                e,
            )

    return customer_id, wallet_id, account_id


def _sincronizar_documento_customer(customer_id: str, doc: str) -> None:
    """Corrige cpfCnpj de um customer já criado (ex.: cadastrado antes da correção do truncamento)."""
    client = get_asaas_client()
    if not client.enabled:
        return
    try:
        client.put(f"/v3/customers/{customer_id}", json={"cpfCnpj": doc})
    except AsaasAPIError:
        logger.warning("Não foi possível sincronizar CPF/CNPJ do customer %s", customer_id)


def garantir_customer_asaas(
    db: Session,
    usuario: Usuario,
    *,
    cpf: str | None = None,
    telefone: str | None = None,
) -> str:
    """Garante asaas_customer_id; cria se ausente. Sincroniza documento se customer já existir."""
    doc = re.sub(r"\D", "", cpf or "")
    if usuario.asaas_customer_id:
        if len(doc) in (11, 14):
            _sincronizar_documento_customer(usuario.asaas_customer_id, doc)
        return usuario.asaas_customer_id
    if settings.ASAAS_DISABLED or not settings.use_asaas:
        raise ValueError("Asaas indisponível")

    cid, wallet, acc = criar_asaas_para_novo_usuario(
        email=usuario.email,
        nome=usuario.nome,
        tipo=usuario.tipo,
        cpf_cnpj=cpf,
        telefone=telefone or usuario.telefone,
    )
    if not cid:
        raise ValueError("Não foi possível criar cliente Asaas")
    usuario.asaas_customer_id = cid
    if wallet and not usuario.asaas_wallet_id:
        usuario.asaas_wallet_id = wallet
    if acc and not usuario.asaas_account_id:
        usuario.asaas_account_id = acc
    db.add(usuario)
    db.flush()
    return cid
