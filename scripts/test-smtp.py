#!/usr/bin/env python3
"""Valida SMTP com envio de e-mail de teste.

Uso:
  EMAIL_USER=... EMAIL_PASSWORD=... python scripts/test-smtp.py destino@exemplo.com
  python scripts/test-smtp.py destino@exemplo.com   # lê .env na raiz
"""

from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from app.services.smtp_client import send_test_email, smtp_configured  # noqa: E402
from config.settings import settings  # noqa: E402


def main() -> int:
    if len(sys.argv) != 2:
        print("Uso: python scripts/test-smtp.py <destino@email>", file=sys.stderr)
        return 2

    destino = sys.argv[1].strip()
    if "@" not in destino:
        print("Destino inválido.", file=sys.stderr)
        return 2

    if not smtp_configured():
        print(
            "SMTP não configurado. Defina no .env:\n"
            "  EMAIL_SERVER, EMAIL_PORT, EMAIL_USER, EMAIL_PASSWORD\n"
            "  EMAIL_FROM_NAME (opcional), EMAIL_USE_TLS=true",
            file=sys.stderr,
        )
        return 1

    print(
        f"Enviando teste via {settings.EMAIL_SERVER}:{settings.EMAIL_PORT} "
        f"como {settings.EMAIL_USER} → {destino}"
    )
    if send_test_email(destino):
        print("OK — verifique a caixa de entrada.")
        return 0
    print("Falha ao enviar.", file=sys.stderr)
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
