"""Garante que main.py importa SessionLocal do módulo correto."""

from __future__ import annotations

import ast
from pathlib import Path


def test_main_bootstrap_usa_sessionlocal_de_config_database():
    src = Path("app/main.py").read_text(encoding="utf-8")
    tree = ast.parse(src)
    imports = [
        node.names[0].name
        for node in ast.walk(tree)
        if isinstance(node, ast.ImportFrom)
        and node.module == "config.database"
        and any(n.name == "SessionLocal" for n in node.names)
    ]
    assert imports, "main.py deve importar SessionLocal de config.database no bootstrap"
    assert "from app.models import SessionLocal" not in src
