"""Testes da escala tonal de marca (brand-color-palette.ts)."""

import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FRONTEND = ROOT / "frontend"


def _run_palette_script(expr: str) -> dict:
    script = f"""
import {{ generateBrandScale }} from './src/lib/brand-color-palette.ts';
console.log(JSON.stringify({expr}));
"""
    result = subprocess.run(
        ["npx", "--yes", "tsx", "-e", script],
        cwd=FRONTEND,
        capture_output=True,
        text=True,
        check=True,
    )
    return json.loads(result.stdout.strip())


def test_brand_scale_anchors_primary_and_dark():
    scale = _run_palette_script("generateBrandScale('#ea580c', '#c2410c')")
    assert scale["600"] == "#ea580c"
    assert scale["700"] == "#c2410c"


def test_brand_scale_default_emerald():
    scale = _run_palette_script("generateBrandScale('#10b981', '#047857')")
    assert scale["600"] == "#10b981"
    assert scale["700"] == "#047857"
    assert scale["50"].startswith("#")
    assert scale["950"].startswith("#")


def test_evento_response_includes_organizer_brand_fields():
    from app.schemas.evento import EventoResponse

    fields = EventoResponse.model_fields
    assert "organizador_brand_primary_color" in fields
    assert "organizador_brand_primary_color_dark" in fields


def test_apply_brand_theme_sets_scale_on_document():
    script = """
import { applyBrandThemeToDocument } from './src/lib/apply-brand-theme.ts';
const props = {};
const el = { style: { setProperty: (k, v) => { props[k] = v; } } };
applyBrandThemeToDocument('#e11d48', '#be123c', el);
console.log(JSON.stringify(props));
"""
    result = subprocess.run(
        ["npx", "--yes", "tsx", "-e", script],
        cwd=FRONTEND,
        capture_output=True,
        text=True,
        check=True,
    )
    props = json.loads(result.stdout.strip())
    assert props["--brand-600"] == "#e11d48"
    assert props["--brand-700"] == "#be123c"
    assert props["--brand-50"].startswith("#")
