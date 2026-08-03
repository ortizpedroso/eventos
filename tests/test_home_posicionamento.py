"""Garante posicionamento da home: organizador no hero + caminho comprador (v1.50)."""

from pathlib import Path

HOME = Path("frontend/src/app/page.tsx").read_text(encoding="utf-8")
DUAL = Path("frontend/src/components/home-audiencias-dual.tsx").read_text(encoding="utf-8")
FEATURES = Path("frontend/src/components/home-produtor-features.tsx").read_text(encoding="utf-8")
FAQ = Path("frontend/src/components/home-faq.tsx").read_text(encoding="utf-8")
PROVA = Path("frontend/src/components/home-prova-social.tsx").read_text(encoding="utf-8")
CENARIOS = Path("frontend/src/components/home-depoimentos.tsx").read_text(encoding="utf-8")


def test_home_hero_marca_e_promessa_organizador():
    assert "EventosBR" in DUAL
    assert "Venda ingresso hoje" in DUAL
    assert "Começar meu evento grátis" in DUAL
    assert 'href="/produtores"' in DUAL
    assert "HomeAudienciasDual" in HOME


def test_home_caminho_comprador_secundario():
    assert "Para quem vai ao evento" in DUAL
    assert "Do PIX ao QR Code" in DUAL
    assert 'href="/eventos"' in DUAL
    assert "Como comprar" in DUAL


def test_home_features_sem_jargon():
    assert "Whitelabel" not in FEATURES
    assert "Split" not in FEATURES
    assert "Sua marca" in FEATURES
    assert "Você recebe na venda" in FEATURES


def test_home_faq_whitelabel_escopo_produtor():
    assert "/produtor/" in FAQ or "página pública do produtor" in FAQ
    assert "página do evento" not in FAQ.lower() or "página pública do produtor" in FAQ


def test_home_prova_social_exige_volume():
    assert "MIN_EVENTOS" in PROVA
    assert "MIN_INGRESSOS" in PROVA


def test_home_cenarios_nao_fingem_depoimento():
    assert "Quem usa, recomenda" not in CENARIOS
    assert "Feito para quem organiza" in CENARIOS


def test_home_precos_copy_lancamento():
    assert "Comece grátis. Pague só quando vender." in HOME


def test_home_usa_scroll_reveal_nas_secoes():
    assert 'className="reveal"' in HOME or "reveal " in HOME
    assert HOME.count("reveal") >= 4
