#!/usr/bin/env python3
"""Sincroniza WhatsApp /contato e admin da plataforma — roda no VPS após deploy.

Uso:
  python3 scripts/sync_platform_contato_admin.py
  docker compose -f docker-compose.prod.yml exec -T api python3 scripts/sync_platform_contato_admin.py
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from app.models import get_db  # noqa: E402
from app.services.bootstrap_platform_admin import ensure_platform_owner_admin  # noqa: E402
from app.services.bootstrap_platform_contact import (  # noqa: E402
    ensure_platform_contact_from_env,
    platform_contact_status,
)


def main() -> int:
    db = next(get_db())
    try:
        ensure_platform_contact_from_env(db)
        ensure_platform_owner_admin(db)
        status = platform_contact_status(db)
    finally:
        db.close()

    print(json.dumps(status, ensure_ascii=False, indent=2))

    ok = bool(status.get("whatsapp_ok")) and bool(status.get("admin_ok"))
    if not ok:
        if not status.get("whatsapp_ok"):
            print(
                "AVISO: WhatsApp da plataforma ainda vazio — "
                "preencha telefone no Perfil do organizador ou Admin → Configurações.",
                file=sys.stderr,
            )
        if not status.get("admin_ok"):
            print(
                "AVISO: nenhum is_platform_admin — cadastre um organizador e reinicie a API.",
                file=sys.stderr,
            )
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
