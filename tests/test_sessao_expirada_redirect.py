"""Sessão expirada redireciona a /auth (não /cadastro)."""

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def test_proxy_sessao_expirada_nao_manda_cadastro():
    src = (ROOT / "frontend/src/proxy.ts").read_text(encoding="utf-8")
    assert "SESSION_EXPIRED_COOKIE" in src
    assert "sessaoExpirada" in src
    assert "login.searchParams.set(\"login\", \"1\")" in src
    # Com expirado=1, não cai no atalho /cadastro de visitante novo
    assert "!sessaoExpirada && pathname === \"/organizador/novo\"" in src


def test_api_401_marca_cookie_e_login():
    src = (ROOT / "frontend/src/lib/api.ts").read_text(encoding="utf-8")
    assert "markSessionExpiredCookie" in src
    assert "login.searchParams.set(\"login\", \"1\")" in src
    assert "clearSessionCache()" in src


def test_auth_page_forca_login_quando_expirado():
    page = (ROOT / "frontend/src/app/auth/page.tsx").read_text(encoding="utf-8")
    assert "sessaoExpirada" in page
    assert "forcarLogin" in page
    assert "expirado" in page


def test_auth_client_login_quando_sessao_expirada():
    client = (ROOT / "frontend/src/app/auth/auth-client.tsx").read_text(encoding="utf-8")
    assert "sessaoExpirada" in client
    assert "sp.get(\"expirado\") === \"1\"" in client
