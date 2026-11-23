#!/usr/bin/env python3
"""Associa (ou remove) o domínio próprio de um organizador e o ativa.

Uso (dentro do container da API, ou localmente com o mesmo DATABASE_URL):
  python3 scripts/set_custom_domain.py cristiano-braga-duarte eventos.agenciadovale.com.br
  python3 scripts/set_custom_domain.py cristiano-braga-duarte --remove
  python3 scripts/set_custom_domain.py cristiano-braga-duarte --cortesia-ate 2027-03-31

Ative só depois que o organizador apontar o domínio para a plataforma (CNAME para o
domínio principal). Com o domínio ativo, o Caddy emite o certificado no primeiro acesso
e o site passa a servir a página do organizador naquele endereço.
"""

from __future__ import annotations

import argparse
import sys
from datetime import date, datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from app.models import Usuario, get_db  # noqa: E402
from app.services.organizador_publico import validar_dominio_proprio  # noqa: E402
from app.services.whitelabel_acesso import acesso_whitelabel, fim_do_dia_brasilia  # noqa: E402


def main() -> int:
    parser = argparse.ArgumentParser(description="Definir/remover domínio próprio do organizador")
    parser.add_argument("slug", help="Slug público do organizador (/produtor/<slug>)")
    parser.add_argument("domain", nargs="?", help="Domínio próprio, ex.: eventos.suamarca.com.br")
    parser.add_argument("--remove", action="store_true", help="Remove o domínio do organizador")
    parser.add_argument(
        "--cortesia-ate",
        type=date.fromisoformat,
        help="Libera o domínio sem mensalidade até esta data (AAAA-MM-DD, até 23h59 de Brasília)",
    )
    args = parser.parse_args()

    acoes = sum([bool(args.domain), args.remove, args.cortesia_ate is not None])
    if acoes != 1:
        parser.error("informe exatamente um: o domínio, --remove ou --cortesia-ate")

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

        if args.cortesia_ate is not None:
            org.whitelabel_cortesia_ate = fim_do_dia_brasilia(args.cortesia_ate)
            db.commit()
            acesso = acesso_whitelabel(org)
            print(f"OK: cortesia de {args.slug} até {args.cortesia_ate:%d/%m/%Y} (acesso: {acesso.motivo}).")
            return 0

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
