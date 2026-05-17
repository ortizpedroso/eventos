"""Tipos de ingresso por lote."""

from __future__ import annotations

TIPOS_INGRESSO = frozenset({"inteira", "meia", "vip", "cortesia"})
TIPO_PADRAO = "inteira"


def normalizar_tipo_ingresso(valor: str | None) -> str:
    s = (valor or TIPO_PADRAO).strip().lower()
    if s not in TIPOS_INGRESSO:
        raise ValueError(f'tipo deve ser um de: {", ".join(sorted(TIPOS_INGRESSO))}')
    return s


def lote_e_cortesia(tipo: str | None) -> bool:
    return (tipo or TIPO_PADRAO).strip().lower() == "cortesia"
