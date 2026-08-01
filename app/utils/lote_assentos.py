"""Parse e normalização da lista de assentos nomeados do lote (MVP)."""

from __future__ import annotations

import re

_ASSENTO_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9\-_/]{0,19}$")
MAX_ASSENTOS_POR_LOTE = 500


def parse_assentos_texto(raw: str | None) -> list[str]:
    """Converte texto 'A1, A2, B1' em lista canônica (ordem preservada, sem duplicatas)."""
    if raw is None:
        return []
    s = str(raw).strip()
    if not s:
        return []
    out: list[str] = []
    seen: set[str] = set()
    for part in s.split(","):
        codigo = part.strip()
        if not codigo:
            continue
        if codigo in seen:
            continue
        if not _ASSENTO_RE.match(codigo):
            raise ValueError(
                f'Assento inválido: "{codigo}". Use letras/números '
                f"(ex.: A1, Mesa-3), até 20 caracteres."
            )
        seen.add(codigo)
        out.append(codigo)
        if len(out) > MAX_ASSENTOS_POR_LOTE:
            raise ValueError(f"Máximo de {MAX_ASSENTOS_POR_LOTE} assentos por lote.")
    return out


def serializar_assentos(codigos: list[str] | None) -> str | None:
    if not codigos:
        return None
    return ", ".join(codigos)


def normalizar_assentos_campo(raw: str | list[str] | None) -> str | None:
    if raw is None:
        return None
    if isinstance(raw, list):
        parsed = parse_assentos_texto(", ".join(str(x) for x in raw))
    else:
        parsed = parse_assentos_texto(raw)
    return serializar_assentos(parsed)
