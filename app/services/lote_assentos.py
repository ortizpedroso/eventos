"""Assentos nomeados do lote — disponibilidade e claim atômico (MVP)."""

from __future__ import annotations

from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.models import EventoIngressoLote, Ingresso
from app.services.ingresso_lotes import agora_utc_naive, reservar_vaga_lote
from app.utils.lote_assentos import parse_assentos_texto


def assentos_do_lote(lote: EventoIngressoLote) -> list[str]:
    try:
        return parse_assentos_texto(getattr(lote, "assentos", None))
    except ValueError:
        return []


def assentos_ocupados(db: Session, lote_id: str) -> set[str]:
    """Assentos com ingresso ativo (pendente válido, pago ou usado/check-in)."""
    agora = agora_utc_naive()
    rows = (
        db.query(Ingresso.assento)
        .filter(
            Ingresso.lote_id == lote_id,
            Ingresso.assento.isnot(None),
            Ingresso.assento != "",
            Ingresso.status.in_(("pendente", "pago", "usado")),
            or_(
                Ingresso.status.in_(("pago", "usado")),
                Ingresso.reservado_ate.is_(None),
                Ingresso.reservado_ate > agora,
            ),
        )
        .all()
    )
    return {str(r[0]) for r in rows if r[0]}


def assentos_disponiveis(db: Session, lote: EventoIngressoLote) -> list[str]:
    cfg = assentos_do_lote(lote)
    if not cfg:
        return []
    occ = assentos_ocupados(db, lote.id)
    return [a for a in cfg if a not in occ]


def lote_usa_assentos(lote: EventoIngressoLote) -> bool:
    return bool(assentos_do_lote(lote))


def reivindicar_assento(
    db: Session,
    lote: EventoIngressoLote,
    assento: str | None,
    *,
    quantidade: int = 1,
) -> str | None:
    """Valida e reivindica assento. Lote deve já estar travado (FOR UPDATE).

    Se o lote não tem assentos configurados, retorna None (compra por quantidade).
    Se tem, exige `assento` disponível e quantidade == 1.
    """
    cfg = assentos_do_lote(lote)
    if not cfg:
        if assento:
            raise ValueError("Este lote não possui assentos nomeados.")
        return None

    codigo = (assento or "").strip()
    if not codigo:
        raise ValueError("Escolha um assento disponível para este lote.")
    if quantidade != 1:
        raise ValueError("Com assentos nomeados, compre 1 ingresso por vez.")
    if codigo not in cfg:
        raise ValueError(f'Assento "{codigo}" não existe neste lote.')
    if codigo in assentos_ocupados(db, lote.id):
        raise ValueError(
            f'Assento "{codigo}" acabou de ser reservado por outro comprador. '
            "Escolha outro."
        )
    return codigo


def reservar_vaga_e_assento(
    db: Session,
    lote_id: str,
    *,
    quantidade: int = 1,
    assento: str | None = None,
) -> tuple[EventoIngressoLote, str | None]:
    """SELECT FOR UPDATE no lote + capacidade + claim de assento (uma transação)."""
    lote = reservar_vaga_lote(db, lote_id, quantidade)
    codigo = reivindicar_assento(db, lote, assento, quantidade=quantidade)
    return lote, codigo
