"""Página pública do produtor/organizador (/produtor/[slug])."""

from __future__ import annotations

import re

from slugify import slugify
from sqlalchemy import func
from sqlalchemy.orm import Session, selectinload

from app.models import Evento, Ingresso, Usuario
from app.services.whitelabel_acesso import acesso_whitelabel
from config.settings import settings

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
        "brand_cover_url": org.brand_cover_url,
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


def normalizar_host(value: str | None) -> str | None:
    s = (value or "").strip().lower().split(":", 1)[0].rstrip(".")
    if not s or len(s) > 253:
        return None
    labels = s.split(".")
    if len(labels) < 2 or not all(_SUBDOMAIN_RE.match(label) for label in labels):
        return None
    return s


def _dominio_base_plataforma() -> str | None:
    return normalizar_host(settings.PLATFORM_BASE_DOMAIN)


def validar_dominio_proprio(value: str | None) -> str | None:
    if value is None or not value.strip():
        return None
    host = normalizar_host(value)
    if not host:
        raise ValueError("Domínio inválido (ex.: eventos.suamarca.com.br)")
    base = _dominio_base_plataforma()
    if base and (host == base or host.endswith(f".{base}")):
        raise ValueError("Use o campo de subdomínio para endereços da própria plataforma")
    return host


def _organizador_por_host(db: Session, host: str) -> Usuario | None:
    base = _dominio_base_plataforma()
    q = db.query(Usuario).filter(Usuario.tipo == "organizador", Usuario.ativo.is_(True))
    if base and host.endswith(f".{base}"):
        try:
            sub = validar_brand_subdomain(host[: -len(base) - 1])
        except ValueError:
            return None
        return q.filter(Usuario.brand_subdomain == sub).first() if sub else None
    if base and host == base:
        return None
    return q.filter(
        Usuario.brand_custom_domain == host,
        Usuario.brand_custom_domain_ativo_em.isnot(None),
    ).first()


def resolver_tenant_por_host(db: Session, host: str | None) -> dict | None:
    """Organizador dono do endereço acessado: subdomínio da plataforma ou domínio próprio ativo."""
    h = normalizar_host(host)
    if not h:
        return None
    org = _organizador_por_host(db, h)
    if not org or not org.slug_publico:
        return None
    base = _dominio_base_plataforma()
    dominio_proprio = not (base and h.endswith(f".{base}"))
    return {
        "host": h,
        "liberado": acesso_whitelabel(org).liberado if dominio_proprio else True,
        "slug": org.slug_publico,
        "organizador_id": org.id,
        "nome": (org.brand_name or org.nome or "").strip() or org.nome,
        "brand_logo_url": org.brand_logo_url or org.foto_url,
        "brand_favicon_url": org.brand_favicon_url or org.foto_url,
        "brand_tema_vitrine": org.brand_tema_vitrine,
        "brand_rodape_texto": org.brand_rodape_texto,
        "brand_primary_color": org.brand_primary_color,
        "brand_primary_color_dark": org.brand_primary_color_dark,
        "social_instagram": org.social_instagram,
        "social_whatsapp": org.social_whatsapp,
        "social_site": org.social_site,
    }
