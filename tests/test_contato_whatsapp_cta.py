"""WhatsApp em /contato — mesmo telefone da plataforma (rodapé)."""

from __future__ import annotations

from pathlib import Path

CONTATO_PAGE = Path("frontend/src/app/contato/page.tsx").read_text(encoding="utf-8")
CTA = Path("frontend/src/components/contato-whatsapp-cta.tsx").read_text(encoding="utf-8")
FOOTER = Path("frontend/src/components/site-footer.tsx").read_text(encoding="utf-8")
RESOLVER = Path("frontend/src/lib/whatsapp-contato.ts").read_text(encoding="utf-8")
ORG_SHELL = Path("frontend/src/app/organizador/organizador-shell.tsx").read_text(encoding="utf-8")


def test_contato_usa_cta_whatsapp_da_plataforma():
    assert "ContatoWhatsappCta" in CONTATO_PAGE
    assert "resolveWhatsappHref" in CTA
    assert "contact_phone" in RESOLVER
    assert "11999999999" not in CTA


def test_resolver_whatsapp_fallback_contact_phone():
    assert "social_whatsapp_url" in RESOLVER
    assert "wa.me/55" in RESOLVER


def test_cta_acima_do_formulario_com_texto_direto():
    assert "Abrir WhatsApp" in CTA
    assert "formulário" in CTA.lower()
    assert "Prefere falar pelo WhatsApp" in CTA
    assert CONTATO_PAGE.index("ContatoWhatsappCta") < CONTATO_PAGE.index("ContatoFormClient")


def test_organizador_admin_abaixo_whitelabel():
    assert "Whitelabel" in ORG_SHELL
    assert "Administração" in ORG_SHELL
    assert "peekSessionCache()?.is_platform_admin" in ORG_SHELL
    assert "AUTH_SYNC_EVENT" in ORG_SHELL
