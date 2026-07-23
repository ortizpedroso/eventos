"""Códigos estáveis de compra indisponível."""

from app.services.evento_repasse import MOTIVO_CHECKOUT_SEM_REPASSE
from app.services.ingresso_lotes import classificar_motivo_compra_indisponivel


def test_classificar_motivo_repasse():
    assert (
        classificar_motivo_compra_indisponivel(MOTIVO_CHECKOUT_SEM_REPASSE) == "repasse"
    )


def test_classificar_motivo_pre_venda():
    assert classificar_motivo_compra_indisponivel("As vendas ainda não começaram") == "pre_venda"
