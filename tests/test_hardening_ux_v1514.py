"""Regressões v1.50.14 — títulos auth, PWA manifest, CSP style residual, axe smoke."""

from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def _read(*parts: str) -> str:
    return (ROOT.joinpath(*parts)).read_text(encoding="utf-8")


def test_manifest_pwa_existe():
    m = _read("frontend/src/app/manifest.ts")
    assert "MetadataRoute.Manifest" in m
    assert 'name: "EventosBR"' in m
    assert "logo-icon.svg" in m
    assert 'display: "browser"' in m


def test_conta_organizador_tem_titulos_pagina():
    assert 'title: "Perfil"' in _read("frontend/src/app/conta/perfil/page.tsx")
    assert 'title: "Meus ingressos"' in _read("frontend/src/app/conta/ingressos/page.tsx")
    assert 'title: "Pagamentos"' in _read("frontend/src/app/conta/pagamentos/page.tsx")
    assert 'title: "Notificações"' in _read("frontend/src/app/conta/notificacoes/page.tsx")
    assert 'title: "Eventos"' in _read("frontend/src/app/organizador/eventos/page.tsx")
    assert 'title: "Financeiro"' in _read("frontend/src/app/organizador/financeiro/page.tsx")
    assert 'title: "Detalhe do ingresso"' in _read(
        "frontend/src/app/conta/ingressos/[id]/layout.tsx"
    )
    # Layouts sem sufixo duplicado (template root aplica | EventosBR)
    conta = _read("frontend/src/app/conta/layout.tsx")
    org = _read("frontend/src/app/organizador/layout.tsx")
    assert 'title: "Minha conta"' in conta
    assert "Minha conta | EventosBR" not in conta
    assert 'title: "Painel do organizador"' in org
    assert "Painel do organizador | EventosBR" not in org


def test_csp_style_documenta_unsafe_inline_intencional():
    csp = _read("frontend/src/lib/csp.ts")
    assert "style-src 'self' 'unsafe-inline'" in csp
    assert "de propósito" in csp or "propósito" in csp
    assert "csp-nonce" in _read("frontend/src/app/layout.tsx")
    theme = _read("frontend/src/components/platform-theme.tsx")
    assert "csp-nonce" in theme
    assert "nonce={nonce}" in theme


def test_axe_smoke_home_no_e2e():
    smoke = _read("frontend/e2e/smoke.spec.ts")
    assert "@axe-core/playwright" in smoke
    assert "home sem violações axe" in smoke
    pkg = _read("frontend/package.json")
    assert "@axe-core/playwright" in pkg
