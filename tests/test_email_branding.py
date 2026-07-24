"""Testes do módulo de branding de e-mails."""

from app.services.email_branding import EmailBranding, build_email_html, format_email_subject


def test_format_email_subject_usa_site_name():
    branding = EmailBranding(
        site_name="Minha Plataforma",
        primary_color="#10b981",
        primary_color_dark="#047857",
        logo_url=None,
        footer_domain="exemplo.com.br",
    )
    assert format_email_subject("Seu ingresso", branding) == "Seu ingresso — Minha Plataforma"


def test_build_email_html_inclui_cores_e_rodape():
    branding = EmailBranding(
        site_name="EventosBR",
        primary_color="#10b981",
        primary_color_dark="#aa0000",
        logo_url=None,
        footer_domain="eventosbr.app.br",
    )
    html = build_email_html(title="Teste", body_html="<p>Corpo</p>", branding=branding)
    assert "color:#aa0000" in html
    assert "EventosBR — eventosbr.app.br" in html
    assert "<h2" in html and "Teste" in html
