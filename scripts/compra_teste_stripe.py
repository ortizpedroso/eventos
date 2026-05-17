#!/usr/bin/env python3
"""
Compra de teste com Stripe (modo test) + confirmação via CLI.

Pré-requisitos:
  1. API em http://127.0.0.1:8000 (Docker ou uvicorn)
  2. STRIPE_SECRET_KEY sk_test_... no .env
  3. STRIPE_WEBHOOK_SECRET whsec_... (scripts/stripe-webhook-setup.ps1)
  4. Em outro terminal: .\\scripts\\stripe-webhook-dev.ps1
  5. Stripe CLI instalado

Uso: python scripts/compra_teste_stripe.py
"""

from __future__ import annotations

import json
import os
import subprocess
import sys
import time
import uuid
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
API = os.environ.get("COMPRA_TESTE_API_URL", "http://127.0.0.1:8000").rstrip("/")
FRONT = os.environ.get("COMPRA_TESTE_FRONT_URL", "http://localhost:3000").rstrip("/")


def _load_dotenv() -> dict[str, str]:
    env: dict[str, str] = {}
    path = ROOT / ".env"
    if not path.is_file():
        return env
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, _, v = line.partition("=")
        v = v.strip().strip('"').strip("'")
        env[k.strip()] = v
    return env


def _http(method: str, path: str, body: dict | None = None, token: str | None = None) -> dict:
    url = f"{API}{path}"
    headers = {"accept": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    data = None
    if body is not None:
        headers["Content-Type"] = "application/json"
        data = json.dumps(body).encode("utf-8")
    req = Request(url, data=data, headers=headers, method=method)
    try:
        with urlopen(req, timeout=30) as resp:
            raw = resp.read().decode("utf-8")
            return json.loads(raw) if raw else {}
    except HTTPError as e:
        err = e.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"{method} {path} -> {e.code}: {err}") from e
    except URLError as e:
        raise RuntimeError(f"API inacessível em {API}: {e}") from e


def main() -> int:
    env = _load_dotenv()
    sk = (env.get("STRIPE_SECRET_KEY") or os.environ.get("STRIPE_SECRET_KEY") or "").strip()
    whsec = (env.get("STRIPE_WEBHOOK_SECRET") or "").strip()
    if not sk.startswith("sk_test_"):
        print("ERRO: defina STRIPE_SECRET_KEY=sk_test_... no .env")
        return 1
    if not whsec.startswith("whsec_"):
        print("AVISO: STRIPE_WEBHOOK_SECRET ausente. Rode: .\\scripts\\stripe-webhook-setup.ps1")
        print("      e em outro terminal: .\\scripts\\stripe-webhook-dev.ps1")
        return 1

    try:
        _http("GET", "/ready")
    except RuntimeError as e:
        print(f"ERRO: {e}")
        return 1

    suf = uuid.uuid4().hex[:8]
    org_email = f"org_stripe_{suf}@test.com"
    cli_email = f"cli_stripe_{suf}@test.com"
    senha = "senha12345"

    print("1. Registrando organizador e cliente de teste…")
    _http(
        "POST",
        "/api/auth/registrar",
        {
            "email": org_email,
            "nome": "Org Stripe Test",
            "senha": senha,
            "tipo": "organizador",
        },
    )
    cli = _http(
        "POST",
        "/api/auth/registrar",
        {
            "email": cli_email,
            "nome": "Cliente Stripe Test",
            "senha": senha,
            "tipo": "cliente",
        },
    )
    org_token = _http(
        "POST",
        "/api/auth/login",
        {"email": org_email, "senha": senha},
    )["access_token"]
    cli_token = _http("POST", "/api/auth/login", {"email": cli_email, "senha": senha})["access_token"]

    print("2. Criando evento publicado…")
    ev = _http(
        "POST",
        "/api/eventos/criar",
        {
            "nome": f"Teste Stripe {suf}",
            "descricao": "Compra teste webhook",
            "data_inicio": "2026-12-15T19:00:00",
            "data_fim": "2026-12-15T23:00:00",
            "local": "São Paulo, SP",
            "preco_ingresso": 50,
            "categoria": "Outros",
            "publicado": True,
            "ingresso_lotes": [{"nome": "Geral", "preco": 50, "ordem": 1, "ativo": True}],
        },
        token=org_token,
    )
    slug = ev["slug"]
    evento_id = ev["id"]
    preco = float(ev.get("preco_compra") or 50)
    valor_centavos = int(round(preco * 100))

    print("3. Criando pagamento (PaymentIntent)…")
    pay = _http(
        "POST",
        "/api/pagamentos/criar",
        {
            "evento_id": evento_id,
            "valor_centavos": valor_centavos,
            "participante_nome": "Participante Teste",
            "participante_email": cli_email,
            "participante_cpf": "52998224725",
            "participante_telefone": "11999999999",
        },
        token=cli_token,
    )
    if pay.get("stripe_disabled"):
        print("ERRO: STRIPE_DISABLED=true — desative no .env para testar Stripe real.")
        return 1

    ingresso_id = pay["ingresso_id"]
    client_secret = pay.get("client_secret") or ""
    pi_id = client_secret.split("_secret_")[0] if "_secret_" in client_secret else None
    if not pi_id and pay.get("client_secret"):
        # client_secret format: pi_xxx_secret_yyy
        parts = pay["client_secret"].split("_secret_")
        if parts[0].startswith("pi_"):
            pi_id = parts[0]

    print(f"   Ingresso: {ingresso_id}")
    print(f"   Página:   {FRONT}/eventos/{slug}")
    if pi_id:
        print(f"   PI:       {pi_id}")

    print("4. Confirmando pagamento com cartão de teste (Stripe CLI)…")
    if not pi_id:
        print("   Não foi possível obter payment_intent id — pague manualmente no site.")
    else:
        return_url = f"{FRONT}/conta/ingressos"
        cmd = [
            "stripe",
            "payment_intents",
            "confirm",
            pi_id,
            "--payment-method",
            "pm_card_visa",
            "--return-url",
            return_url,
        ]
        try:
            proc = subprocess.run(cmd, capture_output=True, text=True, timeout=60)
            out = (proc.stdout or "") + (proc.stderr or "")
            if proc.returncode != 0 or '"error"' in out:
                print(f"   Falha ao confirmar PI: {out[:500]}")
                print("   Alternativa: abra o evento no navegador e use 4242 4242 4242 4242")
                return 1
            if '"status": "succeeded"' not in out and '"status": "requires_action"' in out:
                print("   PI exige ação extra (3DS). Pague no navegador com 4242 4242 4242 4242.")
                return 1
            print("   PaymentIntent confirmado.")
        except FileNotFoundError:
            print("   Stripe CLI não encontrado. Instale: https://stripe.com/docs/stripe-cli")
            return 1
        except subprocess.TimeoutExpired:
            print("   Timeout ao confirmar PI.")
            return 1

    print("5. Aguardando webhook marcar ingresso como pago (até 45s)…")
    for i in range(15):
        time.sleep(3)
        meus = _http("GET", "/api/pagamentos/meus", token=cli_token)
        ing = next((x for x in meus if x["id"] == ingresso_id), None)
        if ing and ing.get("status") == "pago":
            print(f"\nOK — Ingresso PAGO via webhook em ~{(i + 1) * 3}s")
            print(f"   Conta: {FRONT}/conta/ingressos/{ingresso_id}")
            return 0
        print(f"   … status={ing.get('status') if ing else 'não encontrado'} ({(i + 1) * 3}s)")

    print("\nFALHA — ingresso ainda não está pago.")
    print("Checklist:")
    print("  • Terminal com stripe-webhook-dev.ps1 está rodando?")
    print("  • STRIPE_WEBHOOK_SECRET no .env = whsec do stripe listen?")
    print("  • docker compose up -d api após mudar .env (restart não recarrega variáveis)")
    return 1


if __name__ == "__main__":
    sys.exit(main())
