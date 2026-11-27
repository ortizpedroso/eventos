"""Quais eventos aparecem na vitrine da EventosBR (lista, busca, cidades e relacionados)."""

from __future__ import annotations

import re

from sqlalchemy.orm import Query

from app.models import Evento, Usuario
from config.settings import settings

_PADROES_TESTE = (
    re.compile(r"\bcortesia\s*gr[aá]tis\b", re.I),
    re.compile(r"\bevento\s*cortesia\b", re.I),
    re.compile(r"\bru[aá]\s*teste\b", re.I),
    re.compile(r"\bteste\s+stripe\b", re.I),
    re.compile(r"\be2e\b", re.I),
    re.compile(r"^teste\b", re.I),
    re.compile(r"\bevento\s+qa\b", re.I),
    re.compile(r"\bteste\s+pix\b", re.I),
    re.compile(r"\bevento\s+teste\b", re.I),
)


def evento_parece_teste(*, nome: str, local: str | None = None, slug: str = "") -> bool:
    texto = f"{nome} {local or ''} {slug}"
    return any(p.search(texto) for p in _PADROES_TESTE)


def filtrar_vitrine_plataforma(query: Query) -> Query:
    """Evento publicado, com capa e não suspenso, de organizador ativo, com e-mail confirmado e,
    quando há pagamentos, com conta de recebimento aprovada. Quem não cumpre continua com o
    link do evento e a página do produtor, só não entra na vitrine da plataforma."""
    from app.services.evento_repasse import status_repasse_aprovados

    q = query.join(Usuario, Evento.organizador_id == Usuario.id).filter(
        Evento.publicado.is_(True),
        Evento.suspenso_em.is_(None),
        Evento.imagem_url.isnot(None),
        Evento.imagem_url != "",
        Usuario.ativo.is_(True),
        Usuario.email_verificado.is_(True),
    )
    if settings.use_asaas and not settings.payments_disabled:
        q = q.filter(Usuario.asaas_repasse_status.in_(status_repasse_aprovados()))
    return q
