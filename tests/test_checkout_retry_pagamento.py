"""Item 4 (retry/backoff visível em falha de pagamento no checkout)."""

from __future__ import annotations

from pathlib import Path

CHECKOUT_PAINEL = Path("frontend/src/components/checkout-asaas-painel.tsx").read_text(encoding="utf-8")


def test_define_limite_de_tentativas_e_backoff():
    assert "const MAX_TENTATIVAS_COBRANCA = 3;" in CHECKOUT_PAINEL
    assert "const RETRY_BACKOFF_MS = [2000, 4000, 8000];" in CHECKOUT_PAINEL


def test_retry_e_automatico_e_mantem_busy_ate_esgotar_tentativas():
    # Todo o loop de retentativas roda com um único setBusy(true) — o botão de
    # submit fica desabilitado (disabled={busy}) durante as retentativas automáticas,
    # evitando que o comprador clique "pagar" de novo e gere cobrança duplicada.
    assert "for (let tentativa = 1; tentativa <= MAX_TENTATIVAS_COBRANCA; tentativa++)" in CHECKOUT_PAINEL
    assert "await enviarCobranca(body);" in CHECKOUT_PAINEL
    assert "await aguardar(RETRY_BACKOFF_MS[tentativa - 1]);" in CHECKOUT_PAINEL


def test_mostra_status_de_retentativa_em_andamento():
    assert "checkout-retry-status" in CHECKOUT_PAINEL
    assert "Tentando novamente (" in CHECKOUT_PAINEL


def test_mensagem_final_apos_esgotar_tentativas():
    assert "setTentativasEsgotadas(true);" in CHECKOUT_PAINEL
    assert "Tentamos ${MAX_TENTATIVAS_COBRANCA} vezes sem sucesso." in CHECKOUT_PAINEL
    assert '"Tentar novamente"' in CHECKOUT_PAINEL


def test_validacao_de_cartao_nao_entra_no_loop_de_retry():
    # Erro de validação client-side (dados do cartão) é definitivo — não adianta
    # retentar automaticamente, então construirBody() retorna null antes do loop.
    assert "function construirBody(): Record<string, unknown> | null {" in CHECKOUT_PAINEL
    assert "const body = construirBody();\n    if (!body) return;" in CHECKOUT_PAINEL
