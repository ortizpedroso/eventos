"""Normalização de cidade para filtros e formulários."""

from __future__ import annotations

import re


def normalizar_cidade(valor: str | None) -> str | None:
    raw = (valor or "").strip()
    if not raw:
        return None
    return raw[:120]


def inferir_cidade_de_local(local: str | None) -> str | None:
    """Tenta extrair cidade de «Endereço, Cidade» ou «Cidade - UF»."""
    raw = (local or "").strip()
    if not raw:
        return None
    if "," in raw:
        parte = raw.split(",")[-1].strip()
        parte = re.sub(r"\s*-\s*[A-Z]{2}\s*$", "", parte, flags=re.I).strip()
        return normalizar_cidade(parte) if parte else None
    m = re.search(r"-\s*([A-Z]{2})\s*$", raw, flags=re.I)
    if m:
        antes = raw[: m.start()].strip()
        return normalizar_cidade(antes) if antes else None
    return None


def resolver_cidade(cidade: str | None, local: str | None) -> str | None:
    c = normalizar_cidade(cidade)
    if c:
        return c
    return inferir_cidade_de_local(local)
