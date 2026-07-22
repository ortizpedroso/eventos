#!/usr/bin/env python3
"""Testa conectividade com a API de pagamentos em produção via GET /v3/myAccount."""

from __future__ import annotations

import json
import os
import sys

# Permite rodar no VPS sem PYTHONPATH explícito
_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if _ROOT not in sys.path:
    sys.path.insert(0, _ROOT)

from app.services.asaas_client import AsaasAPIError, get_asaas_client
from config.settings import settings


def main() -> int:
    env = settings.asaas_env()
    if settings.ASAAS_DISABLED:
        print("ERRO: ASAAS_DISABLED=true", file=sys.stderr)
        return 1
    key = (settings.ASAAS_API_KEY or "").strip()
    if not key:
        print("ERRO: ASAAS_API_KEY não configurada", file=sys.stderr)
        return 1

    client = get_asaas_client()
    try:
        data = client.request("GET", "/v3/myAccount")
    except AsaasAPIError as exc:
        print(f"ERRO: API Asaas ({env}): {exc}", file=sys.stderr)
        return 1

    if not isinstance(data, dict):
        print("ERRO: resposta inesperada de /v3/myAccount", file=sys.stderr)
        return 2

    wallet = (data.get("walletId") or data.get("id") or "").strip()
    if not wallet:
        try:
            wallets = client.request("GET", "/v3/wallets/")
            if isinstance(wallets, dict):
                items = wallets.get("data") or []
                if items and isinstance(items[0], dict):
                    wallet = str(items[0].get("id") or "").strip()
        except AsaasAPIError:
            pass
    name = (data.get("name") or data.get("company") or "").strip()
    email = (data.get("email") or "").strip()

    platform_wallet = (settings.ASAAS_PLATFORM_WALLET_ID or "").strip()
    out = {
        "environment": env,
        "base_url": settings.asaas_base_url,
        "account_name": name or None,
        "account_email": email or None,
        "wallet_from_api": wallet or None,
        "platform_wallet_env": platform_wallet or None,
        "wallet_match": bool(
            wallet and platform_wallet and wallet.lower() == platform_wallet.lower()
        ),
        "onboarding_mode": settings.asaas_onboarding_mode,
    }
    print(json.dumps(out, ensure_ascii=False, indent=2))

    if platform_wallet and wallet and wallet.lower() != platform_wallet.lower():
        print(
            "AVISO: ASAAS_PLATFORM_WALLET_ID no .env difere do walletId retornado pela API.",
            file=sys.stderr,
        )
        return 3
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
