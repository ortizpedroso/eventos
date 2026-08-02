"""Garante posicionamento da home: comprador × produtor separados (v1.47)."""

from pathlib import Path

HOME = Path("frontend/src/app/page.tsx").read_text(encoding="utf-8")
DUAL = Path("frontend/src/components/home-audiencias-dual.tsx").read_text(encoding="utf-8")


def test_home_cta_produtor_vai_para_produtores():
    assert 'href="/produtores"' in DUAL
    assert "Sou produtor" in DUAL
    assert "Começar meu evento grátis" in DUAL


def test_home_headline_comprador_e_organizador_separados():
    assert "Encontre o evento" in DUAL
    assert "Compre em minutos" in DUAL
    assert "Crie seu evento, venda ingressos" in DUAL
    assert "Para participantes" in DUAL
    assert "Para organizadores" in DUAL
    assert "HomeAudienciasDual" in HOME


def test_home_usa_scroll_reveal_nas_secoes():
    assert 'className="reveal"' in HOME or "reveal " in HOME
    assert HOME.count("reveal") >= 4
