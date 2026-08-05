"""Regressões da auditoria pertinente v1.50.9 (§2.21)."""

from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def test_api_mensagem_rede_generica_em_producao():
    api = (ROOT / "frontend/src/lib/api.ts").read_text(encoding="utf-8")
    assert 'NODE_ENV === "production"' in api
    assert "Não foi possível contactar o servidor" in api
    assert "docker compose" in api  # ainda no ramo de desenvolvimento


def test_not_found_e_error_existem():
    assert (ROOT / "frontend/src/app/not-found.tsx").is_file()
    assert (ROOT / "frontend/src/app/error.tsx").is_file()


def test_sitemap_pagina_eventos():
    sitemap = (ROOT / "frontend/src/app/sitemap.ts").read_text(encoding="utf-8")
    lib = (ROOT / "frontend/src/lib/eventos-publicos.ts").read_text(encoding="utf-8")
    assert "fetchTodosEventosPublicos" in sitemap
    assert "skip" in lib
    assert "fetchTodosEventosPublicos" in lib


def test_produtor_tem_generate_metadata_e_ssr():
    page = (ROOT / "frontend/src/app/produtor/[slug]/page.tsx").read_text(encoding="utf-8")
    assert "generateMetadata" in page
    assert "getProdutorPublicoBySlug" in page
    assert "initialPerfil" in page
    assert "alternates" in page
    assert "twitter" in page


def test_evento_metadata_tem_twitter():
    page = (ROOT / "frontend/src/app/eventos/[slug]/page.tsx").read_text(encoding="utf-8")
    assert "twitter:" in page or "twitter :" in page
    assert "summary_large_image" in page


def test_robots_bloqueia_rotas_privadas_extras():
    robots = (ROOT / "frontend/src/app/robots.ts").read_text(encoding="utf-8")
    assert "/cadastro" in robots
    assert "/ingresso/" in robots
    assert "/eventos/novo" in robots


def test_gitignore_graphify():
    gi = (ROOT / ".gitignore").read_text(encoding="utf-8")
    assert "graphify-out" in gi


def test_next_minimo_16_3():
    pkg = (ROOT / "frontend/package.json").read_text(encoding="utf-8")
    assert '"next": "16.3.0"' in pkg or '"next": "^16.3.0"' in pkg
