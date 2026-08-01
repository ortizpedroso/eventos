"""Item 1 (aviso de meia-entrada) e Item 2 (confirmação de e-mail) no checkout."""

from __future__ import annotations

from pathlib import Path

COMPRAR = Path("frontend/src/components/comprar-ingresso.tsx").read_text(encoding="utf-8")
AVISO_MEIA = Path("frontend/src/components/checkout-aviso-meia-entrada.tsx").read_text(encoding="utf-8")


def test_checkout_renderiza_aviso_meia_entrada_conforme_tipo_do_lote():
    assert "CheckoutAvisoMeiaEntrada" in COMPRAR
    assert 'tipo={loteAtual?.tipo}' in COMPRAR
    # Componente só mostra aviso quando tipo === "meia"; nada para "inteira" ou outros tipos.
    assert 'if (tipo !== "meia") return null;' in AVISO_MEIA
    assert "Lei 12.933/2013" in AVISO_MEIA
    assert "Documento de Identificação Estudantil" in AVISO_MEIA
    assert "DNE/CIE" in AVISO_MEIA


def test_checkout_exige_confirmacao_de_email_do_participante():
    assert "participanteEmailConfirmacao" in COMPRAR
    assert 'id="part_email_confirmacao"' in COMPRAR
    assert "Confirme seu e-mail" in COMPRAR
    # Bloqueia o envio (criarIntent) quando e-mails não coincidem, comparando
    # de forma case-insensitive e ignorando espaços nas pontas.
    assert "em.toLowerCase() !== participanteEmailConfirmacao.trim().toLowerCase()" in COMPRAR
    assert "Os e-mails não coincidem" in COMPRAR
    # Campo de confirmação é resetado junto com o e-mail ao marcar "mesmo pagador".
    assert "setParticipanteEmailConfirmacao(\"\")" in COMPRAR
