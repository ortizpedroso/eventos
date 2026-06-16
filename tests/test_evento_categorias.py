import pytest

from app.utils.evento_categorias import CATEGORIA_PADRAO, normalizar_categoria_evento


def test_normalizar_categoria_valida():
    assert normalizar_categoria_evento("Gastronomia") == "Gastronomia"
    assert normalizar_categoria_evento("  Música  ") == "Música"


def test_normalizar_categoria_vazia_usa_padrao():
    assert normalizar_categoria_evento("") == CATEGORIA_PADRAO
    assert normalizar_categoria_evento(None) == CATEGORIA_PADRAO


def test_normalizar_categoria_invalida():
    with pytest.raises(ValueError, match="categoria deve ser uma de"):
        normalizar_categoria_evento("Invalida")
