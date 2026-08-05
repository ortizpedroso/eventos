"""Regressões v1.50.12 — JSON-LD em páginas públicas + deps audit (§2.23)."""

from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def _read(*parts: str) -> str:
    return (ROOT.joinpath(*parts)).read_text(encoding="utf-8")


def test_public_json_ld_helpers_existem():
    lib = _read("frontend/src/lib/public-json-ld.ts")
    assert "serializeJsonLdForScript" in lib
    assert "buildProdutorJsonLd" in lib
    assert "buildBlogPostingJsonLd" in lib
    assert "buildBlogIndexJsonLd" in lib
    assert "buildEventosListagemJsonLd" in lib
    assert "ProfilePage" in lib
    assert "BlogPosting" in lib
    assert "CollectionPage" in lib
    assert "ItemList" in lib


def test_produtor_page_injeta_json_ld():
    page = _read("frontend/src/app/produtor/[slug]/page.tsx")
    assert "buildProdutorJsonLd" in page
    assert 'type="application/ld+json"' in page
    assert "dangerouslySetInnerHTML" in page


def test_blog_pages_injetam_json_ld():
    index = _read("frontend/src/app/blog/page.tsx")
    post = _read("frontend/src/app/blog/[slug]/page.tsx")
    assert "buildBlogIndexJsonLd" in index
    assert "buildBlogPostingJsonLd" in post
    assert 'type="application/ld+json"' in index
    assert 'type="application/ld+json"' in post


def test_eventos_listagem_injeta_json_ld():
    page = _read("frontend/src/app/eventos/page.tsx")
    assert "buildEventosListagemJsonLd" in page
    assert 'type="application/ld+json"' in page


def test_ci_tem_deps_audit():
    ci = _read(".github/workflows/ci.yml")
    assert "deps-audit" in ci
    assert "npm audit" in ci
    assert "pip-audit" in ci


def test_postcss_override_minimo():
    pkg = _read("frontend/package.json")
    assert '"postcss": "^8.5.25"' in pkg
