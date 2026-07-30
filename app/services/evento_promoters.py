"""Promoters / links de divulgação por evento (?ref=CODIGO). Sem comissão nesta fase."""

from __future__ import annotations

import re
import secrets
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models import Evento, EventoPromoter, Ingresso

_CODIGO_RE = re.compile(r"^[a-zA-Z0-9_-]{3,32}$")
GALERIA_MAX = 6  # reexport convenience for galeria module if needed


def _agora() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def normalizar_codigo(raw: str | None) -> str | None:
    if raw is None:
        return None
    s = str(raw).strip()
    if not s:
        return None
    if not _CODIGO_RE.match(s):
        return None
    return s


def gerar_codigo() -> str:
    return secrets.token_urlsafe(6).replace("-", "").replace("_", "")[:10]


def resolver_promoter_ativo(db: Session, evento_id: str, codigo: str | None) -> EventoPromoter | None:
    cod = normalizar_codigo(codigo)
    if not cod:
        return None
    return (
        db.query(EventoPromoter)
        .filter(
            EventoPromoter.evento_id == evento_id,
            EventoPromoter.ativo.is_(True),
            func.lower(EventoPromoter.codigo) == cod.lower(),
        )
        .first()
    )


def criar_promoter(
    db: Session,
    evento: Evento,
    *,
    codigo: str | None = None,
    rotulo: str | None = None,
) -> EventoPromoter:
    cod = normalizar_codigo(codigo) if codigo else None
    if not cod:
        for _ in range(8):
            candidato = gerar_codigo()
            if not resolver_promoter_ativo(db, evento.id, candidato):
                existing = (
                    db.query(EventoPromoter)
                    .filter(
                        EventoPromoter.evento_id == evento.id,
                        func.lower(EventoPromoter.codigo) == candidato.lower(),
                    )
                    .first()
                )
                if not existing:
                    cod = candidato
                    break
        if not cod:
            raise ValueError("Não foi possível gerar código único")
    else:
        clash = (
            db.query(EventoPromoter)
            .filter(
                EventoPromoter.evento_id == evento.id,
                func.lower(EventoPromoter.codigo) == cod.lower(),
            )
            .first()
        )
        if clash:
            raise ValueError("Já existe um divulgador com este código neste evento")

    rot = (rotulo or "").strip() or None
    if rot and len(rot) > 120:
        rot = rot[:120]
    p = EventoPromoter(
        evento_id=evento.id,
        organizador_id=evento.organizador_id,
        codigo=cod,
        rotulo=rot,
        ativo=True,
        criado_em=_agora(),
    )
    db.add(p)
    db.commit()
    db.refresh(p)
    return p


def listar_promoters_com_metricas(db: Session, evento: Evento) -> list[dict[str, Any]]:
    rows = (
        db.query(EventoPromoter)
        .filter(EventoPromoter.evento_id == evento.id)
        .order_by(EventoPromoter.criado_em.desc())
        .all()
    )
    out: list[dict[str, Any]] = []
    for p in rows:
        vendas = (
            db.query(func.count(Ingresso.id), func.coalesce(func.sum(Ingresso.valor), 0.0))
            .filter(
                Ingresso.promoter_id == p.id,
                Ingresso.status.in_(("pago", "usado")),
            )
            .one()
        )
        qtd = int(vendas[0] or 0)
        receita = round(float(vendas[1] or 0), 2)
        out.append(
            {
                "id": p.id,
                "codigo": p.codigo,
                "rotulo": p.rotulo,
                "ativo": bool(p.ativo),
                "criado_em": p.criado_em.isoformat() if p.criado_em else None,
                "vendas": qtd,
                "receita_bruta": receita,
                # Sem PII do comprador
            }
        )
    return out


def atualizar_promoter(
    db: Session,
    promoter: EventoPromoter,
    *,
    rotulo: str | None = None,
    ativo: bool | None = None,
) -> EventoPromoter:
    if rotulo is not None:
        r = rotulo.strip() or None
        promoter.rotulo = r[:120] if r else None
    if ativo is not None:
        promoter.ativo = bool(ativo)
    db.commit()
    db.refresh(promoter)
    return promoter
