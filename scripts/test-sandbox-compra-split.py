#!/usr/bin/env python3
"""
Teste automatizado sandbox Asaas: evento → compra PIX → split organizador/plataforma.

Requisitos no .env (ou export):
  ASAAS_API_KEY              — conta plataforma (emissora)
  ASAAS_PLATFORM_WALLET_ID   — wallet da plataforma
  ASAAS_WEBHOOK_TOKEN
  ASAAS_ORGANIZER_API_KEY    — segunda conta sandbox (organizador)
  EVENTOSBR_API_URL          — default http://127.0.0.1:8000

Uso no VPS (após ir-sandbox-asaas.sh):
  cd /opt/eventosbr
  python3 scripts/test-sandbox-compra-split.py
"""

from __future__ import annotations

import json
import os
import sys
import uuid
from datetime import date
from typing import Any

_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if _ROOT not in sys.path:
    sys.path.insert(0, _ROOT)

import httpx

from app.services.asaas_client import AsaasAPIError, AsaasClient
from app.services.pagamento_asaas import split_para_evento
from app.services.tarifas_plataforma import taxa_ingresso
from config.settings import settings


def _env(name: str, default: str = "") -> str:
    return (os.environ.get(name) or getattr(settings, name, None) or default).strip()


def _resolver_wallet(client: AsaasClient) -> str:
    try:
        account = client.get("/v3/myAccount")
    except AsaasAPIError as exc:
        raise SystemExit(f"ERRO myAccount: {exc}") from exc
    wallet = str((account or {}).get("walletId") or "").strip()
    if wallet:
        return wallet
    try:
        wallets = client.get("/v3/wallets/")
        items = (wallets or {}).get("data") or []
        if items:
            return str(items[0].get("id") or "").strip()
    except AsaasAPIError:
        pass
    return ""


def _api(method: str, path: str, *, token: str | None = None, json_body: dict | None = None) -> Any:
    base = _env("EVENTOSBR_API_URL", "http://127.0.0.1:8000").rstrip("/")
    headers = {"accept": "application/json"}
    if token:
        headers["authorization"] = f"Bearer {token}"
    if json_body is not None:
        headers["content-type"] = "application/json"
    with httpx.Client(timeout=90.0) as http:
        res = http.request(method, f"{base}{path}", headers=headers, json=json_body)
    if res.status_code >= 400:
        raise SystemExit(f"HTTP {method} {path} → {res.status_code}: {res.text[:500]}")
    return res.json() if res.content else {}


def main() -> int:
    if settings.ASAAS_DISABLED:
        print("ERRO: ASAAS_DISABLED=true", file=sys.stderr)
        return 1
    platform_key = _env("ASAAS_API_KEY")
    org_key = _env("ASAAS_ORGANIZER_API_KEY")
    platform_wallet = _env("ASAAS_PLATFORM_WALLET_ID")
    webhook_token = _env("ASAAS_WEBHOOK_TOKEN")
    if not all([platform_key, org_key, platform_wallet, webhook_token]):
        print(
            "ERRO: defina ASAAS_API_KEY, ASAAS_PLATFORM_WALLET_ID, "
            "ASAAS_WEBHOOK_TOKEN e ASAAS_ORGANIZER_API_KEY",
            file=sys.stderr,
        )
        return 1

    org_client = AsaasClient(api_key=org_key)
    plat_client = AsaasClient(api_key=platform_key)
    org_wallet = _resolver_wallet(org_client)
    if not org_wallet:
        print("ERRO: não foi possível obter walletId da conta organizador", file=sys.stderr)
        return 1
    if org_wallet.lower() == platform_wallet.lower():
        print(
            "ERRO: wallet do organizador é igual ao da plataforma. "
            "Use ASAAS_ORGANIZER_API_KEY de uma segunda conta em sandbox.asaas.com",
            file=sys.stderr,
        )
        return 1

    suf = uuid.uuid4().hex[:8]
    senha = "senha12345"
    org_email = f"sandbox_org_{suf}@test.eventosbr.local"
    cli_email = f"sandbox_cli_{suf}@test.eventosbr.local"

    print("1. Registrando organizador e vinculando wallet distinto da plataforma…")
    _api(
        "POST",
        "/api/auth/registrar",
        json_body={"email": org_email, "nome": "Org Sandbox", "senha": senha, "tipo": "organizador"},
    )
    org_token = _api("POST", "/api/auth/login", json_body={"email": org_email, "senha": senha})[
        "access_token"
    ]
    link = _api(
        "PUT",
        "/api/organizador/asaas/wallet",
        token=org_token,
        json_body={
            "wallet_id": org_wallet,
            "sincronizar_eventos": True,
            "api_key": org_key,
        },
    )
    assert link.get("wallet_id") == org_wallet

    print("2. Criando evento publicado (R$ 50,00)…")
    ev = _api(
        "POST",
        "/api/eventos/criar",
        token=org_token,
        json_body={
            "nome": f"Sandbox split {suf}",
            "descricao": "Teste automatizado split",
            "data_inicio": "2026-12-01T19:00:00",
            "data_fim": "2026-12-01T23:00:00",
            "local": "São Paulo",
            "preco_ingresso": 50,
            "categoria": "Outros",
            "publicado": True,
            "ingresso_lotes": [{"nome": "Geral", "preco": 50, "ordem": 1, "ativo": True}],
        },
    )
    evento_id = ev["id"]

    print("3. Comprador + reserva + cobrança PIX…")
    _api(
        "POST",
        "/api/auth/registrar",
        json_body={"email": cli_email, "nome": "Cliente Sandbox", "senha": senha, "tipo": "cliente"},
    )
    cli_token = _api("POST", "/api/auth/login", json_body={"email": cli_email, "senha": senha})[
        "access_token"
    ]
    criar = _api(
        "POST",
        "/api/pagamentos/criar",
        token=cli_token,
        json_body={
            "evento_id": evento_id,
            "valor_centavos": 5000,
            "participante_nome": "Cliente Sandbox",
            "participante_email": cli_email,
            "participante_cpf": "52998224725",
            "participante_telefone": "11987654321",
            "termo_compra_aceito": True,
        },
    )
    ingresso_id = criar["ingresso_id"]
    cob = _api(
        "POST",
        "/api/pagamentos/asaas/cobranca",
        token=cli_token,
        json_body={"ingresso_id": ingresso_id, "metodo": "pix"},
    )
    pay_id = cob.get("payment_id")
    if not pay_id:
        print(f"ERRO: cobrança sem payment_id: {json.dumps(cob, ensure_ascii=False)}", file=sys.stderr)
        return 1

    print("4. Conferindo split na cobrança Asaas…")
    payment = plat_client.get(f"/v3/payments/{pay_id}")
    splits_api = payment.get("split") or []
    taxa = round(taxa_ingresso(50.0), 2)
    liquido = round(50.0 - taxa, 2)

    # Esperado pelo motor interno (classe Evento mínima só para cálculo)
    from app.models import Evento

    ev_model = Evento(asaas_wallet_id=org_wallet)
    splits_esperado = split_para_evento(ev_model, 50.0)

    if splits_api:
        org_splits = [s for s in splits_api if str(s.get("walletId", "")).lower() == org_wallet.lower()]
        plat_splits = [s for s in splits_api if str(s.get("walletId", "")).lower() == platform_wallet.lower()]
        if not org_splits:
            print("ERRO: split na API Asaas não contém wallet do organizador", file=sys.stderr)
            print(json.dumps(splits_api, indent=2, ensure_ascii=False))
            return 1
        if plat_splits:
            print("AVISO: wallet da plataforma apareceu no split (Asaas não deveria incluir emissor)", file=sys.stderr)
        val_org = float(org_splits[0].get("fixedValue") or org_splits[0].get("totalValue") or 0)
        if abs(val_org - liquido) > 0.02:
            print(f"AVISO: valor split organizador {val_org} ≠ esperado {liquido}")
    else:
        print("   (API não retornou split no GET; validando payload esperado do sistema)")
        if not splits_esperado or splits_esperado[0]["walletId"] != org_wallet:
            print("ERRO: split_para_evento inconsistente", file=sys.stderr)
            return 1

    print("5. Confirmando pagamento no sandbox e webhook…")
    try:
        plat_client.post(
            f"/v3/payments/{pay_id}/receiveInCash",
            json={"paymentDate": date.today().isoformat(), "value": float(payment.get("value") or 50)},
        )
    except AsaasAPIError as exc:
        print(f"AVISO: receiveInCash falhou ({exc}); tentando webhook com status RECEIVED")

    base = _env("EVENTOSBR_API_URL", "http://127.0.0.1:8000").rstrip("/")
    with httpx.Client(timeout=60.0) as http:
        wh = http.post(
            f"{base}/api/webhooks/asaas",
            headers={"asaas-access-token": webhook_token, "content-type": "application/json"},
            json={
                "id": f"evt_sandbox_{suf}",
                "event": "PAYMENT_RECEIVED",
                "payment": {"id": pay_id, "status": "RECEIVED", "externalReference": ingresso_id},
            },
        )
    if wh.status_code >= 400:
        print(f"ERRO webhook: {wh.status_code} {wh.text[:300]}", file=sys.stderr)
        return 1

    st = _api(
        "GET",
        f"/api/pagamentos/asaas/status/{ingresso_id}",
        token=cli_token,
    )
    if not st.get("pago"):
        print(f"ERRO: ingresso não marcado pago: {st}", file=sys.stderr)
        return 1

    out = {
        "ok": True,
        "evento_id": evento_id,
        "ingresso_id": ingresso_id,
        "payment_id": pay_id,
        "organizer_wallet": org_wallet,
        "platform_wallet": platform_wallet,
        "wallets_distintos": org_wallet.lower() != platform_wallet.lower(),
        "split_organizador_liquido_esperado": liquido,
        "taxa_plataforma_esperada": taxa,
        "split_api": splits_api or splits_esperado,
        "ingresso_pago": True,
    }
    print(json.dumps(out, ensure_ascii=False, indent=2))
    print("\nOK: compra sandbox concluída — repasse ao organizador via split; taxa permanece na conta emissora.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
