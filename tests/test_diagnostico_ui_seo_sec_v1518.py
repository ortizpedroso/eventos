"""v1.50.18 — diagnóstico UI/UX/SEO/segurança: correções pertinentes."""

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FRONTEND = ROOT / "frontend"


def test_blog_post_metadata_completa():
    src = (FRONTEND / "src/app/blog/[slug]/page.tsx").read_text(encoding="utf-8")
    assert "alternates: { canonical:" in src
    assert "openGraph:" in src
    assert "twitter:" in src
    assert "description" in src


def test_sitemap_inclui_posts_blog():
    src = (FRONTEND / "src/app/sitemap.ts").read_text(encoding="utf-8")
    assert "listBlogPosts" in src
    assert "/blog/" in src


def test_csp_localhost_somente_dev():
    src = (FRONTEND / "src/lib/csp.ts").read_text(encoding="utf-8")
    assert "Localhost só em desenvolvimento" in src or "só em desenvolvimento" in src
    # Em produção (dev=false) não deve entrar localhost no Set inicial permanente.
    assert 'connect.add("http://127.0.0.1:8000")' in src
    assert "if (dev)" in src


def test_footer_links_contraste_aa():
    src = (FRONTEND / "src/components/site-footer.tsx").read_text(encoding="utf-8")
    assert "text-zinc-300" in src
    assert "underline-offset-2" in src
    # Nav links não devem ficar só em zinc-400 sem underline (falha AA).
    assert 'className="text-zinc-400 hover:text-emerald-300"' not in src
