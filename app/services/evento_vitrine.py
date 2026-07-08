"""Filtros de eventos de teste/demo na vitrine pública."""

from __future__ import annotations

import re

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
