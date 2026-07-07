#!/usr/bin/env python3
"""
Exporta o esquema OpenAPI da API para um arquivo estático, servido pelo
frontend em produção (onde /docs e /openapi.json ficam desligados por
segurança — ver `_docs_on` em app/main.py).

Regenerar sempre que rotas/schemas mudarem:
  python3 scripts/export-openapi.py

Saída: frontend/public/openapi.json
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

OUT_PATH = ROOT / "frontend" / "public" / "openapi.json"


def main() -> int:
    from app.main import app

    schema = app.openapi()
    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUT_PATH.write_text(json.dumps(schema, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"==> OpenAPI exportado: {OUT_PATH} ({len(schema.get('paths', {}))} rotas)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
