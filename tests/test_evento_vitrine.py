"""Testes do filtro de eventos de teste na vitrine pública."""

from app.services.evento_vitrine import evento_parece_teste


def test_evento_cortesia_gratis():
    assert evento_parece_teste(nome="Evento Cortesia Grátis", local="São Paulo", slug="evento-cortesia-gratis")


def test_rua_teste():
    assert evento_parece_teste(nome="Show de Rock", local="Rua Teste 123", slug="show-rock")


def test_evento_qa():
    assert evento_parece_teste(nome="Evento QA abc123", local="SP", slug="evento-qa-abc123")


def test_evento_real_nao_filtrado():
    assert not evento_parece_teste(
        nome="Festival Sertanejo ao Vivo",
        local="Arena Parque Barigui, Curitiba — PR",
        slug="festival-sertanejo",
    )
