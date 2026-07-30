"""Garante posicionamento da home: comprador × produtor separados."""

from pathlib import Path

HOME = Path("frontend/src/app/page.tsx").read_text(encoding="utf-8")


def test_home_cta_produtor_vai_para_produtores():
    assert 'href="/produtores"' in HOME
    assert "Sou produtor" in HOME


def test_home_headline_comprador_e_faixa_produtor():
    assert "Encontre o evento" in HOME
    assert "Compre em minutos" in HOME
    assert "Venda com sua marca. Receba o líquido combinado. Taxa fixa." in HOME
    assert "Comprar ingresso" in HOME


def test_home_usa_scroll_reveal_nas_secoes():
    assert 'className="reveal"' in HOME or "reveal " in HOME
    assert HOME.count("reveal") >= 4
