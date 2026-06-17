"""Perfil público do organizador (/produtor/[slug])."""

from __future__ import annotations

from slugify import slugify
from sqlalchemy import func
from sqlalchemy.orm import Session, selectinload

from app.models import Evento, Ingresso, Usuario


def slug_publico_unico(db: Session, nome: str, usuario_id: str | None = None) -> str:
    base = slugify(nome) or "produtor"
    slug = base
    n = 1
    while True:
        q = db.query(Usuario).filter(Usuario.slug_publico == slug)
        if usuario_id:
            q = q.filter(Usuario.id != usuario_id)
        if not q.first():
            return slug
        slug = f"{base}-{n}"
        n += 1


def garantir_slug_publico(db: Session, usuario: Usuario) -> str:
    if usuario.slug_publico:
        return usuario.slug_publico
    slug = slug_publico_unico(db, usuario.nome or usuario.email.split("@")[0], usuario.id)
    usuario.slug_publico = slug
    db.commit()
    return slug


def montar_perfil_publico(db: Session, slug: str) -> dict | None:
    org = (
        db.query(Usuario)
        .filter(Usuario.slug_publico == slug, Usuario.tipo == "organizador", Usuario.ativo.is_(True))
        .first()
    )
    if not org:
        return None

    eventos = (
        db.query(Evento)
        .options(selectinload(Evento.ingresso_lotes))
        .filter(Evento.organizador_id == org.id, Evento.publicado.is_(True))
        .order_by(Evento.data_inicio.asc())
        .all()
    )

    total_ingressos_pagos = (
        db.query(func.count(Ingresso.id))
        .join(Evento, Ingresso.evento_id == Evento.id)
        .filter(Evento.organizador_id == org.id, Ingresso.status.in_(("pago", "usado")))
        .scalar()
        or 0
    )

    from app.schemas.evento import montar_evento_response
    from app.services.ingresso_lotes import contar_ocupacao_por_lotes

    lote_ids = [l.id for e in eventos for l in e.ingresso_lotes]
    occ = contar_ocupacao_por_lotes(db, lote_ids)
    eventos_out = [montar_evento_response(db, e, ocupacao_por_lote=occ).model_dump() for e in eventos]

    return {
        "slug": org.slug_publico,
        "nome": org.nome,
        "bio": org.bio,
        "foto_url": org.foto_url,
        "social_instagram": org.social_instagram,
        "social_whatsapp": org.social_whatsapp,
        "social_site": org.social_site,
        "metricas": {
            "eventos_publicados": len(eventos),
            "ingressos_pagos": int(total_ingressos_pagos),
        },
        "eventos": eventos_out,
    }
