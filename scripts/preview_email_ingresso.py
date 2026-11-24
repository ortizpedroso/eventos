#!/usr/bin/env python3
"""Envia uma prévia do e-mail de ingresso de um organizador, sem criar ingresso nem cobrar.

Uso (dentro do container da API):
  python3 scripts/preview_email_ingresso.py cristiano-braga-duarte voce@exemplo.com

O e-mail sai igual ao que o comprador recebe (marca do organizador, carteirinha com QR
e rodapé da plataforma), usando o próximo evento publicado do organizador. O QR é de
um ingresso inexistente e não abre a portaria.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path
from types import SimpleNamespace

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from app.models import Evento, Usuario, get_db  # noqa: E402
from app.services.smtp_client import send_prebuilt_message, smtp_configured  # noqa: E402
from app.services.ticket_email import montar_email_ingresso  # noqa: E402


def ingresso_de_exemplo(evento: Evento, destino: str) -> SimpleNamespace:
    precos = [lote.preco for lote in evento.ingresso_lotes if lote.preco]
    return SimpleNamespace(
        id="00000000-0000-0000-0000-000000000000",
        evento=evento,
        valor=min(precos) if precos else 0.0,
        participante_nome="Comprador de teste",
        participante_email=destino,
        usuario=None,
    )


def main() -> int:
    parser = argparse.ArgumentParser(description="Prévia do e-mail de ingresso de um organizador")
    parser.add_argument("slug", help="Slug público do organizador (/produtor/<slug>)")
    parser.add_argument("destino", help="E-mail que recebe a prévia")
    args = parser.parse_args()

    if not smtp_configured():
        print("ERRO: SMTP não configurado (EMAIL_USER/EMAIL_PASSWORD).", file=sys.stderr)
        return 1

    db = next(get_db())
    try:
        org = db.query(Usuario).filter(Usuario.slug_publico == args.slug, Usuario.tipo == "organizador").first()
        if not org:
            print(f"ERRO: nenhum organizador com slug {args.slug!r}.", file=sys.stderr)
            return 1
        evento = (
            db.query(Evento)
            .filter(Evento.organizador_id == org.id, Evento.publicado.is_(True))
            .order_by(Evento.data_inicio.asc())
            .first()
        )
        if not evento:
            print(f"ERRO: {args.slug} não tem evento publicado para montar a prévia.", file=sys.stderr)
            return 1

        msg = montar_email_ingresso(ingresso_de_exemplo(evento, args.destino), db, args.destino)
        if not send_prebuilt_message(msg, destino=args.destino):
            print("ERRO: o envio falhou; veja o log da API.", file=sys.stderr)
            return 1
        print(f"OK: prévia de {evento.nome!r} enviada para {args.destino} ({msg['Subject']}).")
        return 0
    finally:
        db.close()


if __name__ == "__main__":
    raise SystemExit(main())
