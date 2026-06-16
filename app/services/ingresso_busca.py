"""Busca manual de ingressos na portaria (nome, e-mail, CPF)."""

from __future__ import annotations

import re
from typing import Any

from sqlalchemy import or_
from sqlalchemy.orm import Session, joinedload

from app.models import Evento, Ingresso, Usuario

_DIGITS = re.compile(r"\D+")


def _so_digitos(valor: str) -> str:
    return _DIGITS.sub("", valor or "")


def _nome_busca(q: str) -> str:
    return f"%{q.strip()}%"


def _filtro_texto(q: str, ingresso_alias=Ingresso) -> list:
    """Predicados SQLAlchemy para busca por nome/e-mail/CPF."""
    termo = q.strip()
    if not termo:
        return []

    preds: list = []
    lower = termo.lower()

    if "@" in termo:
        preds.append(ingresso_alias.participante_email.ilike(lower))
        preds.append(ingresso_alias.repassado_para_email.ilike(lower))
    else:
        preds.append(ingresso_alias.participante_nome.ilike(_nome_busca(termo)))
        preds.append(ingresso_alias.repassado_para_nome.ilike(_nome_busca(termo)))

    digitos = _so_digitos(termo)
    if len(digitos) >= 3:
        preds.append(ingresso_alias.participante_cpf.ilike(f"%{digitos}%"))
        preds.append(ingresso_alias.repassado_para_cpf.ilike(f"%{digitos}%"))

    return preds


def _serializar(ingresso: Ingresso, evento: Evento) -> dict[str, Any]:
    nome = ingresso.participante_nome or ingresso.repassado_para_nome
    email = ingresso.participante_email or ingresso.repassado_para_email
    cpf = ingresso.participante_cpf or ingresso.repassado_para_cpf
    lote_nome = ingresso.lote.nome if ingresso.lote else None
    return {
        "ingresso_id": ingresso.id,
        "participante_nome": nome,
        "participante_email": email,
        "participante_cpf": cpf,
        "status": ingresso.status,
        "checkin_em": ingresso.checkin_em.isoformat() if ingresso.checkin_em else None,
        "evento_id": evento.id,
        "evento_nome": evento.nome,
        "lote_nome": lote_nome,
    }


def buscar_ingressos_evento(db: Session, evento_id: str, q: str, *, limite: int = 20) -> list[dict[str, Any]]:
    """Busca ingressos pagos/usados de um evento."""
    termo = (q or "").strip()
    if len(termo) < 2:
        return []

    preds = _filtro_texto(termo)
    if not preds:
        return []

    qry = (
        db.query(Ingresso)
        .options(joinedload(Ingresso.lote), joinedload(Ingresso.evento))
        .filter(
            Ingresso.evento_id == evento_id,
            Ingresso.status.in_(("pago", "usado")),
            or_(*preds),
        )
        .order_by(Ingresso.participante_nome.asc())
        .limit(limite)
    )
    resultados: list[dict[str, Any]] = []
    for ing in qry.all():
        ev = ing.evento
        if ev:
            resultados.append(_serializar(ing, ev))
    return resultados


def buscar_ingressos_organizador(
    db: Session,
    organizador: Usuario,
    q: str,
    *,
    evento_id: str | None = None,
    limite: int = 20,
) -> list[dict[str, Any]]:
    """Busca ingressos nos eventos do organizador."""
    termo = (q or "").strip()
    if len(termo) < 2:
        return []

    preds = _filtro_texto(termo)
    if not preds:
        return []

    qry = (
        db.query(Ingresso)
        .join(Evento, Ingresso.evento_id == Evento.id)
        .options(joinedload(Ingresso.lote), joinedload(Ingresso.evento))
        .filter(
            Evento.organizador_id == organizador.id,
            Ingresso.status.in_(("pago", "usado")),
            or_(*preds),
        )
    )
    if evento_id:
        qry = qry.filter(Ingresso.evento_id == evento_id)

    qry = qry.order_by(Ingresso.participante_nome.asc()).limit(limite)

    resultados: list[dict[str, Any]] = []
    for ing in qry.all():
        ev = ing.evento
        if ev:
            resultados.append(_serializar(ing, ev))
    return resultados
