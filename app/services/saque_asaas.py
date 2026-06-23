"""Transferências (saques) via API Asaas na subconta do organizador."""

from __future__ import annotations

import logging
import re
from datetime import datetime, timedelta, timezone
from typing import Any

from sqlalchemy.orm import Session

from app.models import FinanceiroSaque, Usuario
from app.services.asaas_client import AsaasAPIError, AsaasClient
from config.settings import settings

logger = logging.getLogger(__name__)

_STATUS_TRANSFER_PAGO = frozenset({"DONE", "BANK_PROCESSING_DONE"})
_STATUS_TRANSFER_REJEITADO = frozenset({"FAILED", "CANCELLED", "BLOCKED"})
_STATUS_TRANSFER_PROCESSANDO = frozenset(
    {
        "PENDING",
        "BANK_PROCESSING",
        "AWAITING_APPROVAL",
        "SCHEDULED",
        "CREATED",
    }
)


def inferir_pix_tipo(pix_chave: str, pix_tipo: str | None = None) -> str:
    explicito = (pix_tipo or "").strip().upper()
    if explicito in ("CPF", "CNPJ", "EMAIL", "PHONE", "EVP"):
        return explicito
    chave = (pix_chave or "").strip()
    if "@" in chave:
        return "EMAIL"
    digits = re.sub(r"\D", "", chave)
    if len(digits) == 14:
        return "CNPJ"
    if len(digits) == 11:
        if chave.strip().startswith("+") or digits[2] in "89":
            return "PHONE"
        return "CPF"
    if len(digits) in (10, 11) and not chave.isalpha():
        return "PHONE"
    return "EVP"


def normalizar_pix_chave(pix_chave: str, pix_tipo: str) -> str:
    chave = (pix_chave or "").strip()
    tipo = (pix_tipo or "EVP").upper()
    if tipo in ("CPF", "CNPJ", "PHONE"):
        return re.sub(r"\D", "", chave)
    return chave


def criar_transferencia_pix(
    client: AsaasClient,
    *,
    valor: float,
    pix_chave: str,
    pix_tipo: str,
    external_reference: str,
    descricao: str = "Saque EventosBR",
) -> dict[str, Any]:
    tipo = inferir_pix_tipo(pix_chave, pix_tipo)
    chave = normalizar_pix_chave(pix_chave, tipo)
    payload: dict[str, Any] = {
        "value": round(float(valor), 2),
        "pixAddressKey": chave,
        "pixAddressKeyType": tipo,
        "description": descricao[:140],
        "externalReference": external_reference[:100],
    }
    return client.post("/v3/transfers", json=payload, idempotency_key=f"saque_{external_reference}")


def mapear_status_transferencia(status_asaas: str | None) -> str:
    s = (status_asaas or "").strip().upper()
    if s in _STATUS_TRANSFER_PAGO:
        return "pago"
    if s in _STATUS_TRANSFER_REJEITADO:
        return "rejeitado"
    if s in _STATUS_TRANSFER_PROCESSANDO or s:
        return "processando"
    return "pendente"


def previsao_liquidacao_saque(criado_em: datetime) -> datetime:
    horas = max(1, int(settings.FINANCEIRO_PRAZO_TRANSFERENCIA_HORAS))
    return criado_em + timedelta(hours=horas)


def aplicar_webhook_transferencia(
    db: Session,
    transfer: dict[str, Any],
    *,
    event_type: str = "",
) -> FinanceiroSaque | None:
    transfer_id = str(transfer.get("id") or "").strip()
    external_ref = str(transfer.get("externalReference") or "").strip()
    if not transfer_id and not external_ref:
        return None

    q = db.query(FinanceiroSaque)
    if transfer_id:
        saque = q.filter(FinanceiroSaque.asaas_transfer_id == transfer_id).with_for_update().first()
    else:
        saque = q.filter(FinanceiroSaque.id == external_ref).with_for_update().first()
    if not saque:
        return None

    status_asaas = (transfer.get("status") or event_type or "").strip().upper()
    novo = mapear_status_transferencia(status_asaas)
    agora = datetime.now(timezone.utc).replace(tzinfo=None)

    if transfer_id and not saque.asaas_transfer_id:
        saque.asaas_transfer_id = transfer_id

    if novo == "pago" and saque.status != "pago":
        saque.status = "pago"
        saque.processado_em = agora
        if transfer.get("effectiveDate"):
            try:
                saque.processado_em = datetime.fromisoformat(str(transfer["effectiveDate"]).replace("Z", "+00:00")).replace(
                    tzinfo=None
                )
            except (TypeError, ValueError):
                pass
    elif novo == "rejeitado" and saque.status not in ("pago", "cancelado"):
        saque.status = "rejeitado"
        fail = transfer.get("failReason") or transfer.get("failDescription")
        if fail:
            saque.observacao = str(fail)[:500]
    elif novo == "processando" and saque.status == "pendente":
        saque.status = "processando"

    saque.atualizado_em = agora
    db.add(saque)
    return saque


def organizador_tem_cliente_saque(usuario: Usuario) -> bool:
    from app.services.organizador_asaas import _client_subconta

    return _client_subconta(usuario) is not None
