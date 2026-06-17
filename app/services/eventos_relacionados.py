"""Eventos relacionados para página pública."""

from __future__ import annotations

from sqlalchemy.orm import Session, selectinload

from app.models import Evento
from app.schemas.evento import EventoResponse, montar_evento_response
from app.services.ingresso_lotes import contar_ocupacao_por_lotes


def listar_eventos_relacionados(
    db: Session,
    evento: Evento,
    *,
    limite: int = 4,
) -> list[EventoResponse]:
    """Prioridade: mesmo organizador; completar com cidade+categoria."""
    excluir_id = evento.id
    resultados: list[Evento] = []
    vistos: set[str] = {excluir_id}

    def _adicionar(candidatos: list[Evento]) -> None:
        for e in candidatos:
            if e.id in vistos:
                continue
            resultados.append(e)
            vistos.add(e.id)
            if len(resultados) >= limite:
                return

    base = (
        db.query(Evento)
        .options(selectinload(Evento.ingresso_lotes))
        .filter(Evento.publicado.is_(True), Evento.id != excluir_id)
    )

    if evento.organizador_id:
        org = (
            base.filter(Evento.organizador_id == evento.organizador_id)
            .order_by(Evento.data_inicio.asc())
            .limit(limite)
            .all()
        )
        _adicionar(org)
        if len(resultados) >= limite:
            return _montar(db, resultados)

    cidade = (evento.cidade or "").strip()
    categoria = (evento.categoria or "").strip()
    if cidade and categoria:
        restante = limite - len(resultados)
        q = base.filter(Evento.cidade.ilike(cidade), Evento.categoria == categoria)
        if vistos:
            q = q.filter(Evento.id.notin_(list(vistos)))
        outros = q.order_by(Evento.data_inicio.asc()).limit(restante).all()
        _adicionar(outros)

    return _montar(db, resultados[:limite])


def _montar(db: Session, eventos: list[Evento]) -> list[EventoResponse]:
    lote_ids = [l.id for e in eventos for l in e.ingresso_lotes]
    occ = contar_ocupacao_por_lotes(db, lote_ids)
    return [montar_evento_response(db, e, ocupacao_por_lote=occ) for e in eventos]
