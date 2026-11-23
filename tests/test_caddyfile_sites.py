"""Caddyfile de produção: o domínio principal precisa de um bloco próprio.

Sem ele, eventosbr.app.br cai no bloco genérico `https://` dos organizadores, o
`tls-ask` nega o certificado e o site inteiro fica fora do ar (TLS internal error).
"""

from __future__ import annotations

import re
from pathlib import Path

CADDYFILE = Path(__file__).resolve().parents[1] / "deploy" / "caddy" / "Caddyfile"


def _blocos_de_site() -> dict[str, str]:
    texto = CADDYFILE.read_text(encoding="utf-8")
    blocos: dict[str, str] = {}
    for m in re.finditer(r"^([^\s#(][^\n]*?) \{\n(.*?)^\}", texto, flags=re.M | re.S):
        blocos[m.group(1)] = m.group(2)
    return blocos


def test_dominio_principal_tem_bloco_proprio_com_as_rotas():
    blocos = _blocos_de_site()
    assert "{$DOMAIN}" in blocos, f"blocos encontrados: {sorted(blocos)}"
    assert "import eventosbr_rotas" in blocos["{$DOMAIN}"]


def test_www_apenas_redireciona_para_o_dominio_principal():
    bloco = _blocos_de_site()["www.{$DOMAIN}"]
    assert "redir https://{$DOMAIN}{uri} permanent" in bloco
    assert "import eventosbr_rotas" not in bloco


def test_certificado_sob_demanda_so_no_bloco_generico_dos_organizadores():
    blocos = _blocos_de_site()
    assert "on_demand" in blocos["https://"]
    for nome, corpo in blocos.items():
        if nome != "https://":
            assert "on_demand" not in corpo, f"{nome} não pode depender do tls-ask"


def test_sigep_continua_com_bloco_explicito():
    assert "sigep.inovesw.com.br" in _blocos_de_site()
