#!/usr/bin/env python3
"""Lista ou ajusta lotes/eventos com preço pago abaixo do mínimo (R$ 10).

Uso:
  python3 scripts/migrar_precos_minimo_r10.py           # dry-run
  python3 scripts/migrar_precos_minimo_r10.py --apply   # arredonda lotes para R$ 10
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from app.models import Evento, EventoIngressoLote, get_db  # noqa: E402
from app.services.taxas_asaas_publicas import INGRESSO_MINIMO_PAGO_REAIS  # noqa: E402

MINIMO = INGRESSO_MINIMO_PAGO_REAIS


def main() -> int:
    parser = argparse.ArgumentParser(description="Migrar preços abaixo do mínimo pago")
    parser.add_argument("--apply", action="store_true", help="Aplicar correção (preço → R$ 10)")
    args = parser.parse_args()

    db = next(get_db())
    try:
        lotes = (
            db.query(EventoIngressoLote, Evento)
            .join(Evento, EventoIngressoLote.evento_id == Evento.id)
            .filter(
                EventoIngressoLote.preco > 0,
                EventoIngressoLote.preco < MINIMO,
                EventoIngressoLote.ativo.is_(True),
            )
            .all()
        )
        if not lotes:
            print(f"Nenhum lote ativo com preço entre R$ 0,01 e R$ {MINIMO:.2f}.")
            return 0

        print(f"Encontrados {len(lotes)} lote(s) abaixo de R$ {MINIMO:.2f}:")
        for lote, ev in lotes:
            print(f"  - {ev.nome} ({ev.slug}) · lote '{lote.nome}' · R$ {lote.preco:.2f}")

        if not args.apply:
            print("\nDry-run. Use --apply para definir preço = R$ 10,00 nos lotes listados.")
            return 0

        n = 0
        for lote, ev in lotes:
            lote.preco = MINIMO
            if ev.preco_ingresso and 0 < ev.preco_ingresso < MINIMO:
                ev.preco_ingresso = MINIMO
            n += 1
        db.commit()
        print(f"\nAtualizados {n} lote(s) para R$ {MINIMO:.2f}.")
        return 0
    finally:
        db.close()


if __name__ == "__main__":
    raise SystemExit(main())
