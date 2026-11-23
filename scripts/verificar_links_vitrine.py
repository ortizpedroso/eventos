#!/usr/bin/env python3
"""Percorre a vitrine de um organizador e falha se algum link levar o comprador para fora dela.

Uso:
  python3 scripts/verificar_links_vitrine.py https://eventos.agenciadovale.com.br
  python3 scripts/verificar_links_vitrine.py http://localhost:3000 --host eventos.agenciadovale.com.br

Links permitidos fora do domínio: redes sociais do organizador (abrem em nova aba) e a linha
"Plataforma EventosBR" do rodapé. Caminhos internos que o servidor manda para a plataforma
(ex.: /planos) também contam como vazamento, porque o comprador sairia da vitrine.
"""

from __future__ import annotations

import argparse
import sys
import urllib.error
import urllib.request
from html.parser import HTMLParser
from urllib.parse import urljoin, urlsplit

MAX_PAGINAS = 40


class _Links(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.links: list[tuple[str, bool]] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag != "a":
            return
        a = dict(attrs)
        href = (a.get("href") or "").strip()
        if href and not href.startswith(("#", "mailto:", "tel:", "javascript:")):
            self.links.append((href, a.get("target") == "_blank"))


class _SemRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *args, **kwargs):  # noqa: ANN002, ANN003
        return None


def _get(opener: urllib.request.OpenerDirector, url: str, host: str | None) -> tuple[int, str, str]:
    req = urllib.request.Request(url, headers={"Host": host} if host else {})
    try:
        with opener.open(req, timeout=30) as resp:
            return resp.status, resp.headers.get("Location", ""), resp.read().decode("utf-8", "replace")
    except urllib.error.HTTPError as err:
        return err.code, err.headers.get("Location", ""), ""


def main() -> int:
    parser = argparse.ArgumentParser(description="Verifica que a vitrine não vaza links")
    parser.add_argument("base", help="URL da vitrine (ou do servidor, com --host)")
    parser.add_argument("--host", help="Host da vitrine quando base aponta para o servidor direto")
    parser.add_argument("--plataforma", default="eventosbr.app.br", help="Domínio da plataforma")
    args = parser.parse_args()

    base = args.base.rstrip("/")
    opener = urllib.request.build_opener(_SemRedirect)
    pendentes, vistos, falhas = ["/"], set(), []

    while pendentes and len(vistos) < MAX_PAGINAS:
        caminho = pendentes.pop(0)
        if caminho in vistos:
            continue
        vistos.add(caminho)
        status, location, html = _get(opener, f"{base}{caminho}", args.host)

        if status in (301, 302, 303, 307, 308):
            destino = urlsplit(urljoin(f"{base}{caminho}", location))
            if location.startswith(("http://", "https://")) and destino.netloc != urlsplit(base).netloc:
                falhas.append(f"{caminho} redireciona para fora da vitrine: {location}")
            elif destino.path not in vistos:
                pendentes.append(destino.path)
            continue
        if status != 200:
            falhas.append(f"{caminho} respondeu {status}")
            continue

        coletor = _Links()
        coletor.feed(html)
        for href, nova_aba in coletor.links:
            alvo = urlsplit(href)
            if alvo.scheme in ("http", "https"):
                plataforma = alvo.netloc == args.plataforma and alvo.path in ("", "/")
                if not (nova_aba or plataforma):
                    falhas.append(f"{caminho} tem link externo sem nova aba: {href}")
                continue
            if alvo.path and alvo.path not in vistos:
                pendentes.append(alvo.path)

    for f in falhas:
        print(f"FALHA  {f}")
    print(f"{len(vistos)} página(s) verificada(s), {len(falhas)} falha(s).")
    return 1 if falhas else 0


if __name__ == "__main__":
    raise SystemExit(main())
