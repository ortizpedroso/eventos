"""Navbar: auth agrupado; Sobre visível; CTA e nome da conta intactos."""

from pathlib import Path

NAV = Path("frontend/src/components/navbar.tsx").read_text(encoding="utf-8")


def test_navbar_primary_links_sem_flex1_no_desktop():
    assert "data-navbar-primary" in NAV
    assert "data-navbar-desktop" in NAV
    assert "flex min-w-0 flex-1 items-center gap-x-2.5" not in NAV
    assert "flex shrink-0 items-center gap-x-3.5" in NAV


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


def test_navbar_sobre_visivel_sem_compactar_conta_nem_cta():
    """Sobre marcado; nome do usuário e CTA «Crie um evento» sem compactação."""
    assert "data-navbar-sobre" in NAV
    # Nome: faixa mais larga (10rem), como antes da compactação da navbar.
    assert 'className="hidden max-w-[10rem] truncate sm:inline"' in NAV
    assert "max-w-[min(100vw-8rem,14rem)]" in NAV
    assert "userNome" in NAV
    # CTA: mesmo padrão (não encolher ao logar)
    assert 'className="btn-success shrink-0 whitespace-nowrap px-3.5 py-2 text-sm shadow-sm sm:px-4"' in NAV
    assert "px-2.5 py-1.5 text-xs" not in NAV
    assert "Recursos" not in NAV
    assert "data-navbar-dense" not in NAV


def test_btn_success_usa_brand_600():
    """Cor do CTA «Crie um evento» — brand-600 (não o tom mais escuro brand-700)."""
    css = Path("frontend/src/app/globals.css").read_text(encoding="utf-8")
    bloco = css.split(".btn-success")[1].split(".btn-outline")[0]
    assert "var(--brand-600)" in bloco
    assert "background-color: var(--brand-700);" not in bloco.split(":hover")[0]
