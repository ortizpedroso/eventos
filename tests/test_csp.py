"""Garante que a CSP de produção cobre Stripe e Google OAuth."""

from pathlib import Path


def test_csp_fonte_cobre_stripe_google_e_nonce():
    text = Path("frontend/src/lib/csp.ts").read_text(encoding="utf-8")
    for fragment in (
        "strict-dynamic",
        "https://js.stripe.com",
        "https://accounts.google.com",
        "https://apis.google.com",
        "https://oauth2.googleapis.com",
        "'nonce-${nonce}'",
    ):
        assert fragment in text, f"CSP sem {fragment}"


def test_layout_propaga_nonce():
    text = Path("frontend/src/app/layout.tsx").read_text(encoding="utf-8")
    assert 'headers()).get("x-nonce")' in text
    assert "nonce={nonce}" in text
