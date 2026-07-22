#!/usr/bin/env python3
"""
Exporta o esquema OpenAPI da API para um arquivo estático, servido pelo
frontend em produção (onde /docs e /openapi.json ficam desligados por
segurança — ver `_docs_on` em app/main.py).

Regenerar sempre que rotas/schemas mudarem:
  python3 scripts/export-openapi.py

Saída: frontend/public/openapi.json (textos de pagamento sem marca do provedor)
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


def _sanitizar_texto_publico(texto: str) -> str:
    if not texto:
        return texto
    msg = _ASAAS_RE.sub("pagamentos", texto)
    msg = _SUBCONTA_RE.sub("conta de recebimento", msg)
    msg = re.sub(r"\bwalletid\b", "ID da conta", msg, flags=re.I)
    return msg


def _sanitizar_schema(node: object) -> object:
    if isinstance(node, dict):
        out: dict = {}
        for k, v in node.items():
            if k in ("summary", "description", "title") and isinstance(v, str):
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
