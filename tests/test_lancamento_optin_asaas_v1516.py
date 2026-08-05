"""Lançamento v1.50.16 — opt-in gratuito, cursor, Asaas/BC, copy verdadeiro."""

from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def _read(*parts: str) -> str:
    return (ROOT.joinpath(*parts)).read_text(encoding="utf-8")


def test_checkout_gratuito_pre_marca_optin_email_whatsapp():
    src = _read("frontend/src/components/comprar-ingresso.tsx")
    assert "ComunicacaoMarketingOptIn" in src
    assert "ehCortesia" in src
    assert "setAceitaComEmail(true)" in src
    assert "setAceitaComWhatsapp(true)" in src
    assert "aceita_comunicacao_email" in src
    assert "aceita_comunicacao_whatsapp" in src


def test_cursor_pointer_nos_botoes_globais():
    css = _read("frontend/src/app/globals.css")
    assert "button:not(:disabled)" in css
    assert "cursor: pointer" in css
    for cls in (".btn-primary", ".btn-success", ".btn-outline"):
        bloco = css.split(cls)[1].split("}")[0]
        assert "cursor-pointer" in bloco or "cursor: pointer" in css


def test_payment_provider_cita_asaas_e_banco_central():
    src = _read("frontend/src/lib/payment-provider.ts")
    assert 'return "Asaas"' in src or "Asaas" in src
    assert "Banco Central" in src
    assert "não armazena" in src.lower() or "nao armazena" in src.lower()


def test_ajuda_pagamentos_cita_asaas_autorizada_bc():
    ajuda = _read("frontend/src/app/ajuda/pagamentos-e-seguranca/page.tsx")
    low = ajuda.lower()
    assert "asaas" in low
    assert "banco central" in low
    assert "não armazenamos o número completo do cartão" in low
    # Sem claims proibidos
    for p in ("100% seguro", "máxima segurança", "500 req/s", "proteção total"):
        assert p.lower() not in low


def test_sem_hiperboles_filas_e_dois_minutos():
    func = _read("frontend/src/app/funcionalidades/page.tsx")
    prod = _read("frontend/src/app/produtores/page.tsx")
    assert "sem filas" not in func.lower()
    assert "menos de 2 minutos" not in prod.lower()


def test_selos_e_faq_citam_asaas():
    selos = _read("frontend/src/components/home-selos-confianca.tsx")
    faq = _read("frontend/src/components/home-faq.tsx")
    assert "Asaas" in selos or "asaas" in selos.lower()
    assert "Banco Central" in selos or "banco central" in selos.lower() or "descricaoProcessadorPagamento" in selos
    assert "Asaas" in faq
    assert "Banco Central" in faq
