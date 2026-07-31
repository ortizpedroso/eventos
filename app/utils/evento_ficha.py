"""Ficha técnica opcional do evento (classificação, o que levar, estacionamento)."""

from __future__ import annotations

CLASSIFICACAO_ETARIA_OPCOES = ("livre", "12+", "16+", "18+")


def normalizar_classificacao_etaria(v: object) -> str | None:
    if v is None:
        return None
    s = str(v).strip().lower()
    if not s:
        return None
    # Aceita "Livre" / "12+" etc.
    mapa = {o.lower(): o for o in CLASSIFICACAO_ETARIA_OPCOES}
    # "livre" stays; "12+" keys
    if s in mapa:
        return mapa[s]
    if s.replace(" ", "") in mapa:
        return mapa[s.replace(" ", "")]
    raise ValueError(
        "classificacao_etaria inválida (use: livre, 12+, 16+ ou 18+)"
    )


def normalizar_texto_ficha(v: object, *, max_len: int = 280) -> str | None:
    if v is None:
        return None
    s = str(v).strip()
    if not s:
        return None
    if len(s) > max_len:
        raise ValueError(f"texto da ficha técnica excede {max_len} caracteres")
    return s
