"""Lançamento comercial — home dual, SEO, analytics (v1.47)."""

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def test_home_separacao_audiencias_dual():
    page = (ROOT / "frontend/src/app/page.tsx").read_text(encoding="utf-8")
    assert "HomeAudienciasDual" in page
    assert "HomeProdutorFeatures" in page
    assert "HomeFaq" in page


def test_analytics_lib_eventos_padrao():
    src = (ROOT / "frontend/src/lib/analytics.ts").read_text(encoding="utf-8")
    for ev in ("ViewContent", "Lead", "CompleteRegistration", "InitiateCheckout", "Purchase"):
        assert ev in src
    assert "NEXT_PUBLIC_META_PIXEL_ID" in src
    assert "NEXT_PUBLIC_GTM_ID" in src


def test_layout_organization_json_ld():
    layout = (ROOT / "frontend/src/app/layout.tsx").read_text(encoding="utf-8")
    assert "buildOrganizationJsonLd" in layout
    assert "MarketingAnalytics" in layout


def test_noindex_conta_organizador_layouts():
    org = (ROOT / "frontend/src/app/organizador/layout.tsx").read_text(encoding="utf-8")
    conta = (ROOT / "frontend/src/app/conta/layout.tsx").read_text(encoding="utf-8")
    assert "index: false" in org
    assert "index: false" in conta


def test_wizard_etapa_de_tres():
    wizard = (ROOT / "frontend/src/app/eventos/novo/novo-evento-client.tsx").read_text(encoding="utf-8")
    assert "Etapa {step} de" in wizard
    assert "WIZARD_STEPS.length" in wizard


def test_evento_card_cidade_e_cta():
    card = (ROOT / "frontend/src/components/evento-card-vitrine.tsx").read_text(encoding="utf-8")
    assert "e.cidade" in card
    assert "Comprar ingresso" in card


def test_og_image_publico():
    assert (ROOT / "frontend/public/og-image.png").is_file()


def test_marketing_assets_funcionalidades():
    marketing = ROOT / "frontend/public/marketing"
    for name in ("organizador.webp", "checkout.webp", "portaria.webp"):
        assert (marketing / name).is_file()
