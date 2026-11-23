#!/usr/bin/env python3
"""Associa (ou remove) o domínio próprio de um organizador e o ativa.

Uso (dentro do container da API, ou localmente com o mesmo DATABASE_URL):
  python3 scripts/set_custom_domain.py cristiano-braga-duarte eventos.agenciadovale.com.br
  python3 scripts/set_custom_domain.py cristiano-braga-duarte --remove

Ative só depois que o organizador apontar o domínio para a plataforma (CNAME para o
domínio principal). Com o domínio ativo, o Caddy emite o certificado no primeiro acesso
e o site passa a servir a página do organizador naquele endereço.
"""

from __future__ import annotations

import argparse
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from app.models import Usuario, get_db  # noqa: E402
from app.services.organizador_publico import validar_dominio_proprio  # noqa: E402


def main() -> int:
    parser = argparse.ArgumentParser(description="Definir/remover domínio próprio do organizador")
    parser.add_argument("slug", help="Slug público do organizador (/produtor/<slug>)")
    parser.add_argument("domain", nargs="?", help="Domínio próprio, ex.: eventos.suamarca.com.br")
    parser.add_argument("--remove", action="store_true", help="Remove o domínio do organizador")
    args = parser.parse_args()

    if args.remove == bool(args.domain):
        parser.error("informe o domínio ou --remove (apenas um dos dois)")

    db = next(get_db())
    try:
        org = (
            db.query(Usuario)
            .filter(Usuario.slug_publico == args.slug, Usuario.tipo == "organizador")
            .first()
        )
        if not org:
            print(f"ERRO: nenhum organizador com slug {args.slug!r}.", file=sys.stderr)
            return 1

        if args.remove:
            org.brand_custom_domain = None
            org.brand_custom_domain_ativo_em = None
            db.commit()
            print(f"OK: {args.slug} não tem mais domínio próprio.")
            return 0

        try:
            dominio = validar_dominio_proprio(args.domain)
        except ValueError as exc:
            print(f"ERRO: {exc}", file=sys.stderr)
            return 1

        dono = db.query(Usuario).filter(Usuario.brand_custom_domain == dominio, Usuario.id != org.id).first()
        if dono:
            print(f"ERRO: {dominio} já pertence a {dono.slug_publico!r}.", file=sys.stderr)
            return 1

        org.brand_custom_domain = dominio
        org.brand_custom_domain_ativo_em = datetime.now(timezone.utc).replace(tzinfo=None)
        db.commit()
        print(f"OK: https://{dominio} agora serve a página de {args.slug}.")
        return 0
    finally:
        db.close()


if __name__ == "__main__":
    raise SystemExit(main())
