"""Navbar v1.50.4/1.50.5: auth agrupado; com sessão, densidade para caber Sobre."""

from pathlib import Path

NAV = Path("frontend/src/components/navbar.tsx").read_text(encoding="utf-8")


def test_navbar_primary_links_sem_flex1_no_desktop():
    """PrimaryNavLinks não usa flex-1 por padrão (evita Login isolado)."""
    assert "data-navbar-primary" in NAV
    assert "data-navbar-desktop" in NAV
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


def test_navbar_densidade_proporcional_quando_logado():
    """Com sessão: rótulos/gaps menores e Sobre marcado — não some no overflow."""
    assert 'data-navbar-dense={dense ? "1" : "0"}' in NAV
    assert 'data-navbar-logged={loggedIn ? "1" : "0"}' in NAV
    assert "data-navbar-sobre" in NAV
    assert "Recursos" in NAV
    assert 'dense ? "gap-x-2 xl:gap-x-3"' in NAV
    # Conta: nome só em 2xl; CTA "Criar" até 2xl
    assert "2xl:inline" in NAV
    assert 'loggedIn ? "w-28' in NAV or "w-28 min-w-0 shrink" in NAV
