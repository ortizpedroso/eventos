"""SEO: metadata por cidade e typicalAgeRange no JSON-LD do evento."""

from __future__ import annotations

import json
import subprocess
from pathlib import Path

PAGE_LISTAGEM = Path("frontend/src/app/eventos/page.tsx").read_text(encoding="utf-8")
PAGE_EVENTO = Path("frontend/src/app/eventos/[slug]/page.tsx").read_text(encoding="utf-8")
META_LIB = Path("frontend/src/lib/eventos-listagem-metadata.ts")
FICHA_LIB = Path("frontend/src/lib/evento-ficha.ts")


def _node_eval(script: str) -> str:
    r = subprocess.run(
        ["node", "--experimental-strip-types", "--input-type=module", "-e", script],
        cwd="/workspace",
        capture_output=True,
        text=True,
        check=False,
    )
    assert r.returncode == 0, f"stdout={r.stdout}\nstderr={r.stderr}"
    return r.stdout.strip()


def _metadata(**kwargs) -> dict:
    args = json.dumps(kwargs, ensure_ascii=False)
    out = _node_eval(
        f"""
import {{ buildEventosListagemMetadata }} from "./frontend/src/lib/eventos-listagem-metadata.ts";
console.log(JSON.stringify(buildEventosListagemMetadata({args})));
"""
    )
    return json.loads(out)


def _typical(valor) -> str | None:
    payload = "null" if valor is None else json.dumps(valor, ensure_ascii=False)
    out = _node_eval(
        f"""
import {{ typicalAgeRangeFromClassificacao }} from "./frontend/src/lib/evento-ficha.ts";
const v = typicalAgeRangeFromClassificacao({payload});
console.log(v === undefined ? "__UNDEF__" : JSON.stringify(v));
"""
    )
    return None if out == "__UNDEF__" else json.loads(out)


def _json_ld_fragment(classificacao_etaria) -> dict:
    """Espelha o padrão da page: typicalAgeRange opcional some no JSON.stringify (como endDate)."""
    out = _node_eval(
        f"""
import {{ typicalAgeRangeFromClassificacao }} from "./frontend/src/lib/evento-ficha.ts";
const classificacao = {json.dumps(classificacao_etaria, ensure_ascii=False)};
const jsonLd = {{
  "@context": "https://schema.org",
  "@type": "Event",
  name: "Show Teste",
  endDate: "2026-12-01T23:00:00",
  typicalAgeRange: typicalAgeRangeFromClassificacao(classificacao),
}};
console.log(JSON.stringify(jsonLd));
"""
    )
    return json.loads(out)


# --- Metadata listagem ---


def test_page_listagem_usa_helper_metadata():
    assert "buildEventosListagemMetadata" in PAGE_LISTAGEM
    assert "sp.cidade" in PAGE_LISTAGEM
    assert META_LIB.is_file()


def test_metadata_padrao_sem_filtros():
    m = _metadata()
    assert m["title"] == "Eventos | EventosBR"
    assert "Descubra eventos publicados" in m["description"]


def test_metadata_so_categoria_inalterada():
    m = _metadata(categoria="Música")
    assert m["title"] == "Música | Eventos | EventosBR"
    assert m["description"] == (
        "Eventos de Música na EventosBR — datas, locais e ingressos com pagamento seguro."
    )


def test_metadata_so_cidade():
    m = _metadata(cidade="São Paulo")
    assert m["title"] == "Eventos em São Paulo | EventosBR"
    assert m["description"] == (
        "Eventos em São Paulo: datas, locais e ingressos com pagamento seguro na EventosBR."
    )


def test_metadata_cidade_e_categoria_combinados():
    m = _metadata(cidade="São Paulo", categoria="Música")
    assert m["title"] == "Música em São Paulo | EventosBR"
    assert "Música em São Paulo" in m["description"]
    assert "pagamento seguro na EventosBR" in m["description"]


def test_metadata_busca_q_tem_prioridade():
    m = _metadata(q="rock", cidade="Curitiba", categoria="Música")
    assert m["title"] == "Busca: rock | Eventos | EventosBR"
    assert "rock" in m["description"]


# --- typicalAgeRange / JSON-LD ---


def test_page_evento_usa_typical_age_range():
    assert "typicalAgeRangeFromClassificacao" in PAGE_EVENTO
    assert "typicalAgeRange:" in PAGE_EVENTO or "typicalAgeRange :" in PAGE_EVENTO
    assert "typicalAgeRangeFromClassificacao" in FICHA_LIB.read_text(encoding="utf-8")
    # Campo opcional — mesmo padrão de endDate (undefined some no stringify)
    assert "endDate:" in PAGE_EVENTO or "endDate :" in PAGE_EVENTO


def test_typical_age_range_mapeamento_schema():
    assert _typical("livre") == "0-"
    assert _typical("12+") == "12-"
    assert _typical("16+") == "16-"
    assert _typical("18+") == "18-"
    assert _typical(None) is None
    assert _typical("") is None
    assert _typical("   ") is None
    assert _typical("invalido") is None


def test_json_ld_com_classificacao_inclui_typical_age_range():
    ld = _json_ld_fragment("16+")
    assert ld["typicalAgeRange"] == "16-"
    assert ld["@type"] == "Event"
    ld18 = _json_ld_fragment("18+")
    assert ld18["typicalAgeRange"] == "18-"
    assert _json_ld_fragment("livre")["typicalAgeRange"] == "0-"


def test_json_ld_sem_classificacao_omite_typical_age_range():
    ld = _json_ld_fragment(None)
    assert "typicalAgeRange" not in ld
    assert "endDate" in ld  # campos preenchidos permanecem
    assert "typicalAgeRange" not in _json_ld_fragment("")
    assert "typicalAgeRange" not in _json_ld_fragment("   ")
