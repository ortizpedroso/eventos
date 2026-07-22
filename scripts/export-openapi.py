#!/usr/bin/env python3
"""
Exporta o esquema OpenAPI da API para um arquivo estático, servido pelo
frontend em produção (onde /docs e /openapi.json ficam desligados por
segurança — ver `_docs_on` em app/main.py).

Regenerar sempre que rotas/schemas mudarem:
  python3 scripts/export-openapi.py

Saída: frontend/public/openapi.json (textos e paths white-label, sem subconta)
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

OUT_PATH = ROOT / "frontend" / "public" / "openapi.json"

_ASAAS_RE = re.compile(r"\basaas\b", re.I)
_SUBCONTA_RE = re.compile(r"\bsubconta\b", re.I)
_LEGACY_SUBCONTA_PATH = re.compile(r"/subconta(?:/|$)")


def _sanitizar_texto_publico(texto: str) -> str:
    if not texto:
        return texto
    msg = _ASAAS_RE.sub("pagamentos", texto)
    msg = _SUBCONTA_RE.sub("conta de recebimento", msg)
    msg = re.sub(r"\bwalletid\b", "ID da conta", msg, flags=re.I)
    return msg


def _caminho_publico(path: str) -> str:
    return (
        path.replace("/organizador/asaas/", "/organizador/conta-recebimento/")
        .replace("/pagamentos/asaas/", "/pagamentos/")
        .replace("/webhooks/asaas", "/webhooks/pagamentos")
        .replace("/subconta", "/conta-recebimento")
        .replace("/wallet", "/conta")
    )


def _sanitizar_paths(paths: dict) -> dict:
    """Remove aliases legados /subconta e expõe paths white-label na documentação."""
    canonico: dict[str, object] = {}
    for path, ops in (paths or {}).items():
        if _LEGACY_SUBCONTA_PATH.search(path):
            canonico_path = _caminho_publico(path)
            if canonico_path != path and canonico_path in paths:
                continue
        public_path = _caminho_publico(path)
        if public_path in canonico and public_path != path:
            continue
        canonico[public_path] = ops
    return canonico


def _sanitizar_schema(node: object) -> object:
    if isinstance(node, dict):
        out: dict = {}
        for k, v in node.items():
            if k == "paths" and isinstance(v, dict):
                out[k] = _sanitizar_paths(v)
            elif k in ("summary", "description", "title") and isinstance(v, str):
                out[k] = _sanitizar_texto_publico(v)
            else:
                out[k] = _sanitizar_schema(v)
        if "info" in out and isinstance(out["info"], dict):
            info = dict(out["info"])
            if isinstance(info.get("description"), str):
                info["description"] = _sanitizar_texto_publico(info["description"])
            out["info"] = info
        return out
    if isinstance(node, list):
        return [_sanitizar_schema(x) for x in node]
    return node


def main() -> int:
    from app.main import app

    schema = app.openapi()
    schema = _sanitizar_schema(schema)
    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUT_PATH.write_text(json.dumps(schema, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"==> OpenAPI exportado: {OUT_PATH} ({len(schema.get('paths', {}))} rotas)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
