"""Categorias canônicas de eventos (espelham o frontend)."""

from __future__ import annotations

CATEGORIAS_EVENTO: tuple[str, ...] = (
    "Cultura",
    "Esportes",
    "Tecnologia",
    "Negócios",
    "Educação",
    "Música",
    "Religião",
    "Saúde",
    "Gastronomia",
    "Festas e Baladas",
    "Infantil e Família",
    "Feiras e Exposições",
    "Comunidade e Causas",
    "Workshops e Oficinas",
    "Outros",
)

CATEGORIAS_EVENTO_SET = frozenset(CATEGORIAS_EVENTO)
CATEGORIA_PADRAO = "Outros"


def normalizar_categoria_evento(valor: str | None) -> str:
    s = (valor or CATEGORIA_PADRAO).strip()
    if not s:
        return CATEGORIA_PADRAO
    if s not in CATEGORIAS_EVENTO_SET:
        lista = ", ".join(CATEGORIAS_EVENTO)
        raise ValueError(f"categoria deve ser uma de: {lista}")
    return s
