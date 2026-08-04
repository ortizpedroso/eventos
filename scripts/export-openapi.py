#!/usr/bin/env python3
"""
Exporta o esquema OpenAPI da API para arquivo interno do repositório.

Em produção a API não expõe `/docs` nem `/openapi.json` (`_docs_on` em
`app/main.py`). O site público também **não** serve o schema — a saída
fica em `docs/` (uso interno / desenvolvimento), nunca em `frontend/public/`.

Regenerar sempre que rotas/schemas mudarem:
  python3 scripts/export-openapi.py

Saída: docs/openapi.generated.json (textos e paths white-label, sem subconta)
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

OUT_PATH = ROOT / "docs" / "openapi.generated.json"

# Fronteira de palavra tolerante a camelCase/snake_case: "asaas" conta como
# token isolado tanto em "Asaas Iniciar Cobranca" (espaço) quanto em
# "asaas_iniciar_cobranca" (underscore) e "AsaasCobrancaRequest" (próxima
# letra maiúscula = início de nova palavra em camelCase). `\b` puro do Python
# não pega os dois últimos casos porque letra-para-letra e letra-para-"_" não
# são consideradas fronteiras de palavra pelo regex — daí o bug original do
# `openapi.json` ainda vazar "Asaas" em summaries/operationId/nomes de schema.
_ASAAS_RE = re.compile(r"asaas(?=[A-Z]|[^a-zA-Z]|$)", re.I)
_SUBCONTA_RE = re.compile(r"subconta(?=[A-Z]|[^a-zA-Z]|$)", re.I)
_LEGACY_SUBCONTA_PATH = re.compile(r"/subconta(?:/|$)")
_ORG_ASAAS_PREFIX = "/api/organizador/asaas"


def _sanitizar_texto_publico(texto: str) -> str:
    if not texto:
        return texto
    msg = _ASAAS_RE.sub("pagamentos", texto)
    msg = _SUBCONTA_RE.sub("conta de recebimento", msg)
    msg = re.sub(r"\bwalletid\b", "ID da conta", msg, flags=re.I)
    return msg


def _caminho_publico(path: str) -> str:
    if path.startswith(_ORG_ASAAS_PREFIX):
        suffix = path[len(_ORG_ASAAS_PREFIX) :]
        if suffix in ("", "/"):
            return "/api/organizador/conta-recebimento"
        if suffix.startswith("/subconta"):
            suffix = suffix.replace("/subconta", "", 1) or ""
            return "/api/organizador/conta-recebimento" + suffix
        if suffix.startswith("/conta-recebimento"):
            return "/api/organizador" + suffix
        if suffix.startswith("/wallet"):
            return "/api/organizador/conta-recebimento/conta" + suffix[len("/wallet") :]
        return "/api/organizador/conta-recebimento" + suffix
    return (
        path.replace("/pagamentos/asaas/", "/pagamentos/")
        .replace("/webhooks/asaas", "/webhooks/pagamentos")
        .replace("/subconta", "/conta-recebimento")
    )


def _sanitizar_paths(paths: dict) -> dict:
    """Remove aliases legados /subconta e expõe paths white-label na documentação.

    BUG CORRIGIDO: a versão anterior copiava `spec` (o corpo de cada operação —
    summary, description, parameters, requestBody, responses...) sem chamar
    `_sanitizar_schema()` nele. Como o sanitizador só recursava normalmente e
    tratava "paths" como caso especial, o conteúdo *dentro* de cada operação
    nunca passava pela sanitização de texto — daí summaries como "Asaas
    Iniciar Cobranca" continuarem no `openapi.json` mesmo após a exportação.
    """
    canonico: dict[str, dict] = {}
    for path, ops in (paths or {}).items():
        if _LEGACY_SUBCONTA_PATH.search(path):
            canonico_path = _caminho_publico(path)
            if canonico_path != path and canonico_path in paths:
                continue
        public_path = _caminho_publico(path)
        if not isinstance(ops, dict):
            continue
        bucket = canonico.setdefault(public_path, {})
        for method, spec in ops.items():
            bucket[method] = _sanitizar_schema(spec)
    return canonico


def _sanitizar_schema(node: object) -> object:
    if isinstance(node, dict):
        out: dict = {}
        for k, v in node.items():
            if k == "paths" and isinstance(v, dict):
                out[k] = _sanitizar_paths(v)
            elif k in ("summary", "description", "title", "operationId") and isinstance(v, str):
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


def _sanitizar_nome_schema(nome: str) -> str:
    """Sanitiza nomes de schema (ex: `AsaasCobrancaRequest`), preservando
    CamelCase. Só troca o token "Asaas" — "Subconta" fica de fora aqui para
    evitar colisão de nomes (`AsaasSubcontaRequest` e
    `AsaasContaRecebimentoRequest` colidiriam se ambos os tokens fossem
    trocados pelo mesmo texto "ContaRecebimento")."""

    def _sub(m: re.Match) -> str:
        return "Pagamentos" if m.group(0)[0].isupper() else "pagamentos"

    return _ASAAS_RE.sub(_sub, nome)


def _atualizar_refs(node: object, rename_map: dict[str, str]) -> None:
    prefix = "#/components/schemas/"
    if isinstance(node, dict):
        for k, v in node.items():
            if k == "$ref" and isinstance(v, str) and v.startswith(prefix):
                nome_antigo = v[len(prefix) :]
                if nome_antigo in rename_map:
                    node[k] = prefix + rename_map[nome_antigo]
            else:
                _atualizar_refs(v, rename_map)
    elif isinstance(node, list):
        for item in node:
            _atualizar_refs(item, rename_map)


def _renomear_schemas_com_marca(schema: dict) -> dict:
    """Renomeia definições de schema com o nome do provedor (ex:
    `AsaasCobrancaRequest` → `PagamentosCobrancaRequest`) e atualiza todos os
    `$ref` que apontam pra elas — a sanitização de texto (summary/description)
    não alcança nomes de schema porque eles não são strings de `summary` ou
    `description`, são chaves de `components.schemas` e valores de `$ref`."""
    schemas = schema.get("components", {}).get("schemas")
    if not isinstance(schemas, dict):
        return schema
    rename_map: dict[str, str] = {}
    usados: set[str] = set(schemas.keys())
    for nome in schemas:
        novo = _sanitizar_nome_schema(nome)
        if novo == nome:
            continue
        candidato = novo
        sufixo = 2
        while candidato in usados and candidato != nome:
            candidato = f"{novo}{sufixo}"
            sufixo += 1
        rename_map[nome] = candidato
        usados.add(candidato)
    if not rename_map:
        return schema
    schema["components"]["schemas"] = {
        rename_map.get(nome, nome): definicao for nome, definicao in schemas.items()
    }
    _atualizar_refs(schema, rename_map)
    return schema


def main() -> int:
    from app.main import app

    schema = app.openapi()
    schema = _sanitizar_schema(schema)
    schema = _renomear_schemas_com_marca(schema)
    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUT_PATH.write_text(json.dumps(schema, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"==> OpenAPI exportado: {OUT_PATH} ({len(schema.get('paths', {}))} rotas)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
