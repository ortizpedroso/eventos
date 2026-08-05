"""v1.50.17 — cadastro em /cadastro e CTAs públicos sem /auth?mode=register."""

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FRONTEND = ROOT / "frontend"


def test_sobre_cta_usa_cadastro():
    src = (FRONTEND / "src/app/sobre/page.tsx").read_text(encoding="utf-8")
    assert 'href="/cadastro"' in src
    assert 'href="/auth?mode=register"' not in src


def test_blog_welcome_usa_cadastro():
    src = (FRONTEND / "content/blog/bem-vindo-eventosbr.md").read_text(encoding="utf-8")
    assert "](/cadastro)" in src
    assert "/auth?mode=register" not in src


def test_auth_redirect_mode_register_para_cadastro():
    src = (FRONTEND / "src/app/auth/page.tsx").read_text(encoding="utf-8")
    assert 'redirect("/cadastro")' in src
    assert "modeParam === \"register\"" in src or "modeParam === 'register'" in src


def test_auth_client_cadastre_se_link_cadastro():
    src = (FRONTEND / "src/app/auth/auth-client.tsx").read_text(encoding="utf-8")
    assert 'href="/cadastro"' in src
    assert "Cadastre-se" in src


def test_navbar_mobile_cta_curto():
    src = (FRONTEND / "src/components/navbar.tsx").read_text(encoding="utf-8")
    assert 'className="md:hidden">Criar</span>' in src
    assert "max-w-[9.5rem]" in src


def test_globals_overflow_mobile():
    src = (FRONTEND / "src/app/globals.css").read_text(encoding="utf-8")
    assert "overflow-x: clip" in src
    assert "max-width: 100%" in src
    assert "scrollbar-gutter: auto" in src
