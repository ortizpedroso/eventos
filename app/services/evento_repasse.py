"""Wallet de repasse Asaas por evento (split organizador) e regras de publicação."""

from __future__ import annotations

import json
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.models import Evento, Usuario
from config.settings import settings

MOTIVO_COMPRA_SEM_REPASSE = (
    "O organizador ainda não configurou a conta de repasses. "
    "As vendas serão liberadas após a conta ser aprovada em Financeiro."
)

MOTIVO_COMPRA_REPASSE_PENDENTE = (
    "A conta de repasses do organizador está em análise. "
    "As vendas serão liberadas assim que a aprovação for concluída."
)

MOTIVO_CHECKOUT_SEM_REPASSE = (
    "Este evento ainda não tem conta de repasse Asaas aprovada. "
    "O organizador deve concluir a abertura da conta em Financeiro antes de vender ingressos."
)

MOTIVO_PUBLICAR_SEM_REPASSE = (
    "Para publicar um evento com ingressos pagos, crie e aguarde a aprovação da conta de repasses "
    "em Organizador → Financeiro. O evento pode ficar pausado enquanto isso."
)

STATUS_REPASSE_APROVADOS_BASE = frozenset({"approved"})


def status_repasse_aprovados() -> frozenset[str]:
    """Status que liberam publicação/venda. `manual` só quando wallet manual é permitido."""
    if settings.asaas_allow_manual_wallet:
        return STATUS_REPASSE_APROVADOS_BASE | frozenset({"manual"})
    return STATUS_REPASSE_APROVADOS_BASE


def repasse_status_aprovado(status: str | None) -> bool:
    return (status or "").strip().lower() in status_repasse_aprovados()


def evento_exige_repasse_aprovado(db: Session, evento: Evento) -> bool:
    """Eventos gratuitos (cortesia) não exigem repasse para publicar/vender."""
    if settings.payments_disabled or not settings.use_asaas:
        return False
    for lote in evento.ingresso_lotes or []:
        if lote.ativo and float(lote.preco or 0) > 0:
            return True
    return float(evento.preco_ingresso or 0) > 0


def organizador_repasse_aprovado(usuario: Usuario) -> bool:
    return repasse_status_aprovado(getattr(usuario, "asaas_repasse_status", None))


def resolver_wallet_repasse_evento(db: Session, evento: Evento) -> str | None:
    """Wallet do evento ou, em fallback, do organizador (sem persistir)."""
    wid = (evento.asaas_wallet_id or "").strip()
    if wid:
        return wid
    org_id = (evento.organizador_id or "").strip()
    if not org_id:
        return None
    org = db.query(Usuario).filter(Usuario.id == org_id).first()
    if not org:
        return None
    return (org.asaas_wallet_id or "").strip() or None


def persistir_wallet_evento_se_ausente(db: Session, evento: Evento, wallet_id: str) -> bool:
    """Grava wallet no evento se ainda estiver vazio. Retorna True se alterou."""
    wid = (wallet_id or "").strip()
    if not wid or (evento.asaas_wallet_id or "").strip():
        return False
    evento.asaas_wallet_id = wid
    db.add(evento)
    return True


def garantir_wallet_repasse_evento(db: Session, evento: Evento) -> str | None:
    """Resolve wallet e persiste no evento quando vier do organizador."""
    wid = resolver_wallet_repasse_evento(db, evento)
    if wid:
        persistir_wallet_evento_se_ausente(db, evento, wid)
    return wid


def organizador_pode_vender(db: Session, evento: Evento) -> tuple[bool, str | None]:
    if not evento_exige_repasse_aprovado(db, evento):
        return True, None
    org = db.query(Usuario).filter(Usuario.id == evento.organizador_id).first()
    if not org:
        return False, MOTIVO_COMPRA_SEM_REPASSE
    if not resolver_wallet_repasse_evento(db, evento):
        return False, MOTIVO_COMPRA_SEM_REPASSE
    if not organizador_repasse_aprovado(org):
        status = (org.asaas_repasse_status or "").lower()
        if status in ("pending", "awaiting_approval", ""):
            return False, MOTIVO_COMPRA_REPASSE_PENDENTE
        return False, MOTIVO_COMPRA_SEM_REPASSE
    if not (settings.ASAAS_PLATFORM_WALLET_ID or "").strip():
        return False, "Pagamentos temporariamente indisponíveis. Tente novamente mais tarde."
    return True, None


def validar_publicacao_evento_pago(db: Session, usuario: Usuario, evento: Evento, publicado: bool) -> None:
    from fastapi import HTTPException

    if not publicado:
        return
    if not evento_exige_repasse_aprovado(db, evento):
        return
    if usuario.tipo != "organizador" or evento.organizador_id != usuario.id:
        raise HTTPException(status_code=403, detail="Sem permissão para publicar este evento.")
    if not resolver_wallet_repasse_evento(db, evento) and not (usuario.asaas_wallet_id or "").strip():
        raise HTTPException(status_code=400, detail=MOTIVO_PUBLICAR_SEM_REPASSE)
    if not organizador_repasse_aprovado(usuario):
        raise HTTPException(status_code=400, detail=MOTIVO_PUBLICAR_SEM_REPASSE)


def agora_utc_naive() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def serializar_detalhes_repasse(detalhes: dict) -> str:
    return json.dumps(detalhes, ensure_ascii=False)
