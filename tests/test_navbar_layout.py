"""Navbar v1.50.4: links sem flex-1 em lg+; auth agrupado (não isolado à direita)."""

from pathlib import Path

NAV = Path("frontend/src/components/navbar.tsx").read_text(encoding="utf-8")


def test_navbar_primary_links_sem_flex1_no_desktop():
    """PrimaryNavLinks não usa flex-1 por padrão (evita Login isolado)."""
    assert "data-navbar-primary" in NAV
    assert "data-navbar-desktop" in NAV
    # A definição do nav principal não deve abrir com flex-1
    assert 'className={`flex min-w-0 items-center gap-x-3.5' in NAV
    assert "flex min-w-0 flex-1 items-center gap-x-2.5" not in NAV


def test_navbar_auth_agrupado_apos_links():
    assert "data-navbar-auth" in NAV
    assert "border-l border-zinc-200" in NAV
    assert 'href="/auth"' in NAV
    assert "data-navbar-account" in NAV


def test_navbar_reage_a_sessao_ao_logar():
    assert "AUTH_SYNC_EVENT" in NAV
    assert "fetchSession" in NAV
    assert "loggedIn" in NAV
    assert "Crie um evento" in NAV
