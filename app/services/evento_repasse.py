"""Wallet de repasse Asaas por evento (split organizador)."""

from __future__ import annotations

from sqlalchemy.orm import Session

from app.models import Evento, Usuario

MOTIVO_COMPRA_SEM_REPASSE = (
    "O organizador ainda não configurou a conta de repasses. "
    "As vendas serão liberadas após configurar em Financeiro."
)

MOTIVO_CHECKOUT_SEM_REPASSE = (
    "Este evento ainda não tem conta de repasse Asaas. "
    "O organizador deve configurar o walletId em Financeiro antes de vender ingressos."
)


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
