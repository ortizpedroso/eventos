"""WhatsApp público da plataforma deriva do telefone de contato quando social vazio."""

from __future__ import annotations

from app.models.platform_settings import PlatformSettings
from app.services.platform_settings import _merge_row


def test_whatsapp_publico_usa_contact_phone_quando_social_vazio():
    row = PlatformSettings(
        id="default",
        contact_phone="11987654321",
        social_whatsapp_url=None,
    )
    pub = _merge_row(row)
    assert pub.social_whatsapp_url == "https://wa.me/5511987654321"
    assert pub.contact_phone == "11987654321"


def test_whatsapp_publico_respeita_social_quando_preenchido():
    row = PlatformSettings(
        id="default",
        contact_phone="11987654321",
        social_whatsapp_url="https://wa.me/5521988776655",
    )
    pub = _merge_row(row)
    assert pub.social_whatsapp_url == "https://wa.me/5521988776655"
