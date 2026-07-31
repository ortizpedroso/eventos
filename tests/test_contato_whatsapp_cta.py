"""WhatsApp CTA em /contato — só com social_whatsapp_url da plataforma."""

from __future__ import annotations

from pathlib import Path

CONTATO_PAGE = Path("frontend/src/app/contato/page.tsx").read_text(encoding="utf-8")
CTA = Path("frontend/src/components/contato-whatsapp-cta.tsx").read_text(encoding="utf-8")
FOOTER = Path("frontend/src/components/site-footer.tsx").read_text(encoding="utf-8")


def test_contato_usa_cta_whatsapp_da_plataforma():
    assert "ContatoWhatsappCta" in CONTATO_PAGE
    assert "social_whatsapp_url" in CTA
    assert "return null" in CTA
    # Mesmo campo do rodapé — não hardcoded
    assert "social_whatsapp_url" in FOOTER
    assert "11999999999" not in CTA
    assert "wa.me/5511" not in CTA


def test_cta_abre_link_configurado_sem_substituir_formulario():
    assert "Abrir WhatsApp" in CTA
    assert "formulário" in CTA.lower()
