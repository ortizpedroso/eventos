"""Regressões v1.50.10 — Ajuda nav uniforme + copy verdadeiro (§2.22)."""

from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def _read(*parts: str) -> str:
    return (ROOT.joinpath(*parts)).read_text(encoding="utf-8")


def test_ajuda_nav_mesmo_estilo_indice():
    nav = _read("frontend/src/components/ajuda-nav.tsx")
    assert "ajuda-nav-link" in nav
    assert "navLinkClass" in nav
    assert 'label: "Índice"' in nav
    # Um único helper de classe para todos os botões
    assert nav.count("navLinkClass(") >= 1
    assert "font-semibold" not in nav


def test_ajuda_indice_cards_mesmo_padrao_tipografico():
    page = _read("frontend/src/app/ajuda/page.tsx")
    assert "ajuda-nav-link" in page
    assert "text-sm font-normal" in page
    assert "pagamentos-e-seguranca" in page


def test_prose_nao_sobrescreve_ajuda_nav():
    css = _read("frontend/src/app/globals.css")
    assert ".ajuda-nav" in css
    assert "ajuda-nav-link" in css


def test_sem_claims_100_porcento_seguro():
    arquivos = [
        "frontend/src/components/home-selos-confianca.tsx",
        "frontend/src/components/home-faq.tsx",
        "frontend/src/app/funcionalidades/page.tsx",
        "frontend/src/app/sobre/page.tsx",
        "frontend/src/lib/payment-provider.ts",
        "frontend/src/components/checkout-asaas-painel.tsx",
    ]
    proibidos = [
        "100% seguro",
        "100% seguros",
        "proteção total",
        "máxima segurança",
        "padrão ouro",
        "500 req/s",
        "pagamento seguro pela plataforma",
        "Segurança de nível global",
    ]
    for rel in arquivos:
        texto = _read(rel)
        for p in proibidos:
            assert p.lower() not in texto.lower(), f"{rel} ainda contém «{p}»"


def test_copy_nao_armazena_cartao_e_processador():
    selos = _read("frontend/src/components/home-selos-confianca.tsx")
    checkout = _read("frontend/src/components/checkout-asaas-painel.tsx")
    ajuda = _read("frontend/src/app/ajuda/pagamentos-e-seguranca/page.tsx")
    assert "não armazena" in selos.lower() or "nao armazena" in selos.lower()
    assert "processador" in checkout.lower() or "parceiro de pagamentos" in checkout.lower()
    assert "não armazenamos o número completo do cartão" in ajuda.lower()
    assert "pico" in ajuda.lower()
    # White-label: não citar marca Asaas no site público
    assert "asaas" not in ajuda.lower()


def test_sobre_sem_garantia_500_rps():
    sobre = _read("frontend/src/app/sobre/page.tsx")
    assert "500 req" not in sobre
    assert "picos extremos" in sobre.lower() or "mais lenta" in sobre.lower()
