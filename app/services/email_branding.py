"""Branding compartilhado para e-mails transacionais (cores e identidade da plataforma)."""

from __future__ import annotations

from dataclasses import dataclass
from urllib.parse import urlparse

from sqlalchemy.orm import Session

from app.schemas.platform_settings import PlatformSettingsPublic
from app.services.platform_settings import get_public_settings
from app.utils.html_escape import esc
from config.settings import settings

COLOR_TEXT = "#18181b"
COLOR_MUTED = "#71717a"
COLOR_FOOTER = "#a1a1aa"
COLOR_ERROR = "#b91c1c"


@dataclass(frozen=True)
class EmailBranding:
    site_name: str
    primary_color: str
    primary_color_dark: str
    logo_url: str | None
    footer_domain: str

    @classmethod
    def from_settings(cls, ps: PlatformSettingsPublic) -> EmailBranding:
        base = (settings.FRONTEND_PUBLIC_URL or "http://localhost:3000").rstrip("/")
        domain = urlparse(base).netloc or "eventosbr.app.br"
        return cls(
            site_name=(ps.site_name or "EventosBR").strip() or "EventosBR",
            primary_color=ps.primary_color or "#10b981",
            primary_color_dark=ps.primary_color_dark or "#047857",
            logo_url=ps.logo_url,
            footer_domain=domain,
        )


def get_email_branding(db: Session | None = None) -> EmailBranding:
    from app.schemas.platform_settings import PlatformSettingsPublic

    defaults = PlatformSettingsPublic(
        site_name="EventosBR",
        primary_color="#10b981",
        primary_color_dark="#047857",
    )

    def _load(session: Session) -> EmailBranding:
        try:
            return EmailBranding.from_settings(get_public_settings(session))
        except Exception:
            return EmailBranding.from_settings(defaults)

    if db is not None:
        return _load(db)
    from config.database import SessionLocal

    db_local = SessionLocal()
    try:
        return _load(db_local)
    finally:
        db_local.close()


def format_email_subject(title: str, branding: EmailBranding | None = None) -> str:
    b = branding or get_email_branding()
    return f"{title} — {b.site_name}"


def link_style(branding: EmailBranding) -> str:
    return f"color:{branding.primary_color_dark}"


def _logo_header(logo_url: str | None, site_name: str) -> str:
    if not logo_url or logo_url.strip().lower().startswith("data:image/"):
        return ""
    return (
        f'<p style="margin:0 0 16px">'
        f'<img src="{esc(logo_url)}" alt="{esc(site_name)}" height="40" '
        f'style="max-height:40px;width:auto;display:block"/>'
        f"</p>"
    )


def build_email_html(
    *,
    title: str,
    body_html: str,
    branding: EmailBranding | None = None,
    error: bool = False,
    footer_note: str | None = None,
    organizer_name: str | None = None,
) -> str:
    b = branding or get_email_branding()
    heading_color = COLOR_ERROR if error else b.primary_color_dark
    org_block = ""
    if organizer_name:
        org_block = (
            f'<p style="font-size:12px;color:{COLOR_MUTED};margin:0 0 12px">'
            f"Organizador: <strong>{esc(organizer_name)}</strong></p>"
        )
    footer = footer_note or f"{esc(b.site_name)} — {esc(b.footer_domain)}"
    return (
        f'<div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:{COLOR_TEXT}">'
        f"{_logo_header(b.logo_url, b.site_name)}"
        f'<h2 style="color:{heading_color};margin:0 0 16px">{esc(title)}</h2>'
        f"{org_block}"
        f"{body_html}"
        f'<p style="font-size:11px;color:{COLOR_FOOTER};margin-top:24px">{footer}</p>'
        "</div>"
    )
