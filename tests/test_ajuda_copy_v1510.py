"""Regressões Ajuda — formatação Índice + copy verdadeiro (§2.22 / v1.50.11)."""

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
    # Formatação do Índice: text-sm + font-medium (não font-normal)
    assert "text-sm font-medium" in nav
    assert "font-normal" not in nav
    assert nav.count("navLinkClass(") >= 1


def test_ajuda_indice_cards_formato_anterior():
    """Cards do índice restaurados: título text-base font-semibold emerald."""
    page = _read("frontend/src/app/ajuda/page.tsx")
    assert "text-base font-semibold text-emerald-700" in page
    assert "rounded-xl border border-zinc-200 bg-white p-4 shadow-sm" in page
    assert "pagamentos-e-seguranca" in page
    # Não reintroduzir pills no lugar dos cards
    assert "flex flex-col gap-1 rounded-full" not in page


def test_prose_nav_preserva_peso_indice():
    css = _read("frontend/src/app/globals.css")
    assert ".ajuda-nav a.ajuda-nav-link" in css
    assert "font-weight: 500" in css
    # Não forçar peso 400 nos pills (erro da v1.50.10)
    assert "font-weight: 400" not in css.split("Central de Ajuda")[1].split(".content-prose strong")[0]


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


def test_copy_nao_armazena_cartao_e_asaas_bc():
    selos = _read("frontend/src/components/home-selos-confianca.tsx")
    checkout = _read("frontend/src/components/checkout-asaas-painel.tsx")
    ajuda = _read("frontend/src/app/ajuda/pagamentos-e-seguranca/page.tsx")
    assert "não armazena" in selos.lower() or "nao armazena" in selos.lower()
    assert "asaas" in checkout.lower()
    assert "banco central" in checkout.lower()
    assert "não armazenamos o número completo do cartão" in ajuda.lower()
    assert "pico" in ajuda.lower()
    # Credibilidade: citar Asaas + autorização BC (v1.50.16)
    assert "asaas" in ajuda.lower()
    assert "banco central" in ajuda.lower()


def test_sobre_sem_garantia_500_rps():
    sobre = _read("frontend/src/app/sobre/page.tsx")
    assert "500 req" not in sobre
    assert "picos extremos" in sobre.lower() or "mais lenta" in sobre.lower()
