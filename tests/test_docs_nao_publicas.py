"""Documentação técnica e OpenAPI não devem ser públicos no site."""

from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def test_paginas_documentacao_removidas_do_frontend():
    assert not (ROOT / "frontend/src/app/documentacao/page.tsx").exists()
    assert not (ROOT / "frontend/src/app/documentacao/api/page.tsx").exists()


def test_openapi_nao_esta_em_public():
    assert not (ROOT / "frontend/public/openapi.json").exists()


def test_export_openapi_escreve_fora_de_public():
    import importlib.util

    path = ROOT / "scripts" / "export-openapi.py"
    spec = importlib.util.spec_from_file_location("export_openapi", path)
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)

    out = Path(module.OUT_PATH)
    assert "public" not in out.parts
    assert out.name == "openapi.generated.json"
    assert out.parent.name == "docs"


def test_sitemap_e_footer_sem_documentacao():
    sitemap = (ROOT / "frontend/src/app/sitemap.ts").read_text(encoding="utf-8")
    footer = (ROOT / "frontend/src/components/site-footer.tsx").read_text(encoding="utf-8")
    assert "/documentacao" not in sitemap
    assert "documentacao" not in footer.lower()
