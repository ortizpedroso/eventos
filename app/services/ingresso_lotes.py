"""Regras de lotes de ingresso: elegibilidade, contagem e resolução para compra."""

from __future__ import annotations

from collections.abc import Sequence
from datetime import datetime, timezone

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models import Evento, EventoIngressoLote, Ingresso
from app.utils.ingresso_tipos import TIPO_PADRAO, normalizar_tipo_ingresso


def agora_utc_naive() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def contar_ocupacao_lote(db: Session, lote_id: str) -> int:
    return (
        db.query(func.count(Ingresso.id))
        .filter(
            Ingresso.lote_id == lote_id,
            Ingresso.status.in_(("pendente", "pago")),
        )
        .scalar()
    ) or 0


def contar_ocupacao_por_lotes(db: Session, lote_ids: Sequence[str]) -> dict[str, int]:
    """Uma consulta agregada para vários lotes (evita N+1 em listagens)."""
    if not lote_ids:
        return {}
    ids = list(dict.fromkeys(lote_ids))
    rows = (
        db.query(Ingresso.lote_id, func.count(Ingresso.id))
        .filter(
            Ingresso.lote_id.in_(ids),
            Ingresso.status.in_(("pendente", "pago")),
        )
        .group_by(Ingresso.lote_id)
        .all()
    )
    out: dict[str, int] = {lid: 0 for lid in ids}
    for lid, c in rows:
        if lid is not None:
            out[str(lid)] = int(c)
    return out


def lote_elegivel_compra(
    db: Session,
    lote: EventoIngressoLote,
    agora: datetime | None = None,
    *,
    ocupacao_por_lote: dict[str, int] | None = None,
) -> bool:
    if not lote.ativo:
        return False
    agora = agora or agora_utc_naive()
    if lote.vendas_inicio is not None and agora < lote.vendas_inicio:
        return False
    if lote.vendas_fim is not None and agora > lote.vendas_fim:
        return False
    if lote.quantidade_maxima is not None:
        if ocupacao_por_lote is not None:
            vendidos = ocupacao_por_lote.get(lote.id, 0)
        else:
            vendidos = contar_ocupacao_lote(db, lote.id)
        if vendidos >= lote.quantidade_maxima:
            return False
    return True


def resolver_lote_compra(
    db: Session,
    evento: Evento,
    *,
    ocupacao_por_lote: dict[str, int] | None = None,
) -> EventoIngressoLote | None:
    lotes = sorted(evento.ingresso_lotes, key=lambda x: (x.ordem, x.id))
    agora = agora_utc_naive()
    for l in lotes:
        if lote_elegivel_compra(db, l, agora, ocupacao_por_lote=ocupacao_por_lote):
            return l
    return None


def preco_minimo_lotes_ativos(db: Session, evento_id: str) -> float | None:
    lotes = (
        db.query(EventoIngressoLote)
        .filter(EventoIngressoLote.evento_id == evento_id, EventoIngressoLote.ativo.is_(True))
        .all()
    )
    if not lotes:
        return None
    return min(l.preco for l in lotes)


def sincronizar_preco_ingresso_evento(db: Session, evento: Evento) -> None:
    m = preco_minimo_lotes_ativos(db, evento.id)
    if m is not None:
        evento.preco_ingresso = m


def criar_lotes_iniciais(db: Session, evento: Evento, preco_padrao: float, nome_primeiro: str = "Geral") -> None:
    lote = EventoIngressoLote(
        evento_id=evento.id,
        nome=nome_primeiro,
        tipo=TIPO_PADRAO,
        preco=float(preco_padrao),
        ordem=1,
        quantidade_maxima=None,
        ativo=True,
        vendas_inicio=None,
        vendas_fim=None,
    )
    db.add(lote)


def substituir_lotes_evento(
    db: Session,
    evento: Evento,
    itens: list[dict],
) -> None:
    if not itens:
        raise ValueError("Defina pelo menos um lote de ingressos.")

    current = (
        db.query(EventoIngressoLote)
        .filter(EventoIngressoLote.evento_id == evento.id)
        .all()
    )
    incoming_ids = {str(x["id"]) for x in itens if x.get("id")}

    for lote in current:
        if lote.id not in incoming_ids:
            if contar_ocupacao_lote(db, lote.id) > 0:
                raise ValueError(
                    f'Não é possível remover o lote "{lote.nome}" porque já existem ingressos associados.',
                )
            db.delete(lote)
    db.flush()

    for raw in itens:
        lid = raw.get("id")
        nome = (raw.get("nome") or "").strip() or "Lote"
        preco = float(raw["preco"])
        ordem = int(raw.get("ordem") or 1)
        qmax = raw.get("quantidade_maxima")
        qmax = int(qmax) if qmax is not None else None
        ativo = bool(raw.get("ativo", True))
        vi = raw.get("vendas_inicio")
        vf = raw.get("vendas_fim")

        tipo = normalizar_tipo_ingresso(str(raw.get("tipo") or TIPO_PADRAO))

        if lid:
            lo = db.get(EventoIngressoLote, str(lid))
            if lo is not None and lo.evento_id == evento.id:
                lo.nome = nome
                lo.tipo = tipo
                lo.preco = preco
                lo.ordem = ordem
                lo.quantidade_maxima = qmax
                lo.ativo = ativo
                lo.vendas_inicio = vi
                lo.vendas_fim = vf
                continue

        db.add(
            EventoIngressoLote(
                evento_id=evento.id,
                nome=nome,
                tipo=tipo,
                preco=preco,
                ordem=ordem,
                quantidade_maxima=qmax,
                ativo=ativo,
                vendas_inicio=vi,
                vendas_fim=vf,
            )
        )

    db.flush()
    db.refresh(evento)
    sincronizar_preco_ingresso_evento(db, evento)
