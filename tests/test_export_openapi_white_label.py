"""Spec eventosbr-producao.md §3 (white-label): `export-openapi.py` não deve
vazar a marca do provedor de pagamentos em `openapi.json` — nem em
summary/description (bug original: `_sanitizar_paths` copiava a operação sem
sanitizar), nem em `operationId`, nem em nomes de schema (`AsaasXxxRequest`)."""

from __future__ import annotations

import json
import re


def _load_module():
    import importlib.util
    from pathlib import Path

    path = Path(__file__).resolve().parents[1] / "scripts" / "export-openapi.py"
    spec = importlib.util.spec_from_file_location("export_openapi", path)
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


def test_openapi_exportado_sem_marca_do_provedor():
    module = _load_module()
    from app.main import app

    schema = app.openapi()
    schema = module._sanitizar_schema(schema)
    schema = module._renomear_schemas_com_marca(schema)
    texto = json.dumps(schema)

    assert not re.search(r"asaas", texto, re.I), "openapi.json ainda expõe a marca do provedor"


def test_openapi_sem_referencias_quebradas_apos_renomear_schemas():
    module = _load_module()
    from app.main import app

    schema = app.openapi()
    schema = module._sanitizar_schema(schema)
    schema = module._renomear_schemas_com_marca(schema)

    nomes_schema = set(schema.get("components", {}).get("schemas", {}).keys())
    texto = json.dumps(schema)
    refs = set(re.findall(r"#/components/schemas/([A-Za-z0-9_]+)", texto))

    faltando = refs - nomes_schema
    assert not faltando, f"$ref apontando para schema inexistente: {faltando}"


def test_operacao_dentro_de_paths_e_sanitizada():
    """Regressão do bug: `_sanitizar_paths` não chamava `_sanitizar_schema`
    no corpo da operação, então summaries como 'Asaas Iniciar Cobranca'
    continuavam vazando mesmo após a 'sanitização'."""
    module = _load_module()
    from app.main import app

    schema = app.openapi()
    schema = module._sanitizar_schema(schema)

    encontrou_operacao_pagamento = False
    for ops in schema.get("paths", {}).values():
        for op in ops.values():
            if not isinstance(op, dict):
                continue
            summary = op.get("summary") or ""
            description = op.get("description") or ""
            operation_id = op.get("operationId") or ""
            assert "asaas" not in summary.lower()
            assert "asaas" not in description.lower()
            assert "asaas" not in operation_id.lower()
            if "cobran" in summary.lower():
                encontrou_operacao_pagamento = True

    assert encontrou_operacao_pagamento, "teste não encontrou nenhuma operação de cobrança para validar"
