"""Página pública do produtor/organizador (/produtor/[slug])."""

from __future__ import annotations

import re

from slugify import slugify
from sqlalchemy import func
from sqlalchemy.orm import Session, selectinload

from app.models import Evento, Ingresso, Usuario

_SUBDOMAIN_RE = re.compile(r"^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$")
_HEX_COLOR = re.compile(r"^#[0-9A-Fa-f]{6}$")
RESERVED_SUBDOMAINS = frozenset(
    {"www", "api", "admin", "app", "mail", "smtp", "cdn", "static", "dev", "staging", "test"}
)


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


def validar_brand_subdomain(value: str | None) -> str | None:
    if value is None:
        return None
    s = value.strip().lower()
    if not s:
        return None
    if len(s) < 3 or len(s) > 63 or not _SUBDOMAIN_RE.match(s):
        raise ValueError("Subdomínio inválido (3–63 caracteres, letras minúsculas, números e hífen)")
    if s in RESERVED_SUBDOMAINS:
        raise ValueError("Subdomínio reservado pela plataforma")
    return s


def validar_brand_color(value: str | None) -> str | None:
    if value is None:
        return None
    s = value.strip()
    if not s:
        return None
    if not _HEX_COLOR.match(s):
        raise ValueError("Cor deve ser hexadecimal (#RRGGBB)")
    return s.lower()


def _brand_payload(org: Usuario) -> dict:
    return {
        "brand_name": org.brand_name,
        "brand_logo_url": org.brand_logo_url,
        "brand_primary_color": org.brand_primary_color,
        "brand_primary_color_dark": org.brand_primary_color_dark,
        "brand_subdomain": org.brand_subdomain,
    }


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

    display_name = (org.brand_name or org.nome or "").strip() or org.nome

    return {
        "slug": org.slug_publico,
        "nome": display_name,
        "bio": org.bio,
        "foto_url": org.foto_url or org.brand_logo_url,
        "social_instagram": org.social_instagram,
        "social_whatsapp": org.social_whatsapp,
        "social_site": org.social_site,
        "metricas": {
            "eventos_publicados": len(eventos),
            "ingressos_pagos": int(total_ingressos_pagos),
        },
        "eventos": eventos_out,
        **_brand_payload(org),
    }


def resolver_tenant_por_subdomain(db: Session, subdomain: str) -> dict | None:
    try:
        sub = validar_brand_subdomain(subdomain)
    except ValueError:
        return None
    if not sub:
        return None
    org = (
        db.query(Usuario)
        .filter(
            Usuario.brand_subdomain == sub,
            Usuario.tipo == "organizador",
            Usuario.ativo.is_(True),
        )
        .first()
    )
    if not org or not org.slug_publico:
        return None
    display_name = (org.brand_name or org.nome or "").strip() or org.nome
    return {
        "slug": org.slug_publico,
        "subdomain": sub,
        "nome": display_name,
        "brand_logo_url": org.brand_logo_url or org.foto_url,
        "brand_primary_color": org.brand_primary_color,
        "brand_primary_color_dark": org.brand_primary_color_dark,
    }
