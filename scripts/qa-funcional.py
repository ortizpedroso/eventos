#!/usr/bin/env python3
"""Testes funcionais reais — organizador e cliente (API)."""

from __future__ import annotations

import sys
import time
from pathlib import Path

import httpx

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from app.services.ingresso_checkin import codigo_checkin

API = "http://127.0.0.1:8000"
WEB = "http://127.0.0.1:3000"


def record(results: list, name: str, ok: bool, detail: str = "") -> None:
    results.append((name, ok, detail))
    mark = "OK" if ok else "FALHA"
    print(f"  [{mark}] {name}" + (f" — {detail}" if detail else ""))


def main() -> int:
    results: list[tuple[str, bool, str]] = []
    suf = int(time.time())
    org_email = f"qa_org_{suf}@test.com"
    cli_email = f"qa_cli_{suf}@test.com"
    senha = "SenhaTeste123!"

    print("=== Testes funcionais EventosBR ===\n")

    print("[Infraestrutura]")
    try:
        h = httpx.get(f"{API}/health", timeout=10).json()
        record(results, "API /health", h.get("status") == "ok")
        r = httpx.get(f"{API}/ready", timeout=10)
        record(results, "API /ready", r.status_code == 200, r.json().get("database", ""))
        w = httpx.get(WEB, timeout=15, follow_redirects=True)
        record(results, "Frontend /", w.status_code == 200)
        auth = httpx.get(f"{WEB}/auth?mode=register", timeout=15)
        record(results, "Página /auth com formulário", 'id="email"' in auth.text)
    except Exception as e:
        record(results, "Infraestrutura", False, str(e))
        return 1

    c = httpx.Client(base_url=API, timeout=30)

    print("\n[Organizador]")
    reg_org = c.post(
        "/api/auth/registrar",
        json={"email": org_email, "nome": "QA Organizador", "senha": senha, "tipo": "organizador"},
    )
    record(results, "Registro organizador", reg_org.status_code == 200)
    org_h = {"Authorization": f"Bearer {reg_org.json()['access_token']}"}
    record(results, "Sessão organizador", c.get("/api/auth/me", headers=org_h).json()["tipo"] == "organizador")

    criar = c.post(
        "/api/eventos/criar",
        headers=org_h,
        json={
            "nome": f"Evento QA {suf}",
            "descricao": "Teste automatizado",
            "data_inicio": "2026-12-25T20:00:00",
            "data_fim": "2026-12-25T23:00:00",
            "local": "São Paulo, SP",
            "preco_ingresso": 50,
            "categoria": "Outros",
            "publicado": True,
            "ingresso_lotes": [{"nome": "Geral", "preco": 50, "ordem": 1, "ativo": True}],
        },
    )
    record(results, "Criar e publicar evento", criar.status_code == 200)
    ev = criar.json()
    eid, slug = ev["id"], ev["slug"]

    record(results, "Listar eventos públicos", any(e.get("slug") == slug for e in c.get("/api/eventos").json()))
    record(results, "Meus eventos", c.get("/api/eventos/meus", headers=org_h).status_code == 200)
    port = c.get(f"/api/eventos/id/{eid}/link-portaria", headers=org_h)
    record(results, "Link portaria", port.status_code == 200)
    token = port.json().get("token", "")
    record(results, "Relatório organizador", c.get("/api/relatorios/organizador", headers=org_h).status_code == 200)

    print("\n[Cliente — checkout]")
    reg_cli = c.post(
        "/api/auth/registrar",
        json={"email": cli_email, "nome": "QA Cliente", "senha": senha, "tipo": "cliente"},
    )
    record(results, "Registro cliente", reg_cli.status_code == 200)
    cli_h = {"Authorization": f"Bearer {reg_cli.json()['access_token']}"}

    pag = c.post(
        "/api/pagamentos/criar",
        headers=cli_h,
        json={"evento_id": eid, "termo_compra_aceito": True, "valor_centavos": 5000},
    )
    record(results, "Checkout ASAAS_DISABLED", pag.status_code == 200, pag.text[:100])
    ingresso_id = pag.json().get("ingresso_id", "") if pag.status_code == 200 else ""
    record(results, "Ingresso confirmado", pag.json().get("payments_disabled") is True if pag.status_code == 200 else False)
    record(results, "Meus ingressos", any(i["id"] == ingresso_id for i in c.get("/api/ingressos/meus", headers=cli_h).json()))
    record(results, "QR Code", c.get(f"/api/ingressos/{ingresso_id}/qr", headers=cli_h).status_code == 200 if ingresso_id else False)

    print("\n[Compra rápida]")
    rap_email = f"qa_rapida_{suf}@test.com"
    rap = c.post("/api/auth/compra-rapida", json={"email": rap_email, "nome": "Cliente Rapido"})
    record(results, "Conta compra rápida", rap.status_code == 200)
    rap_h = {"Authorization": f"Bearer {rap.json()['access_token']}"}
    me = c.get("/api/auth/me", headers=rap_h)
    record(results, "E-mail pendente verificação", me.json().get("email_verificado") is False)
    rap_pay = c.post(
        "/api/pagamentos/criar",
        headers=rap_h,
        json={"evento_id": eid, "termo_compra_aceito": True, "valor_centavos": 5000},
    )
    record(results, "Checkout após compra rápida", rap_pay.status_code == 200)

    print("\n[Portaria]")
    if token and ingresso_id:
        codigo = codigo_checkin(ingresso_id)
        record(results, "Info portaria", c.get("/api/portaria/evento", params={"evento_id": eid, "k": token}).status_code == 200)
        chk = c.post("/api/portaria/validar", json={"evento_id": eid, "token": token, "codigo": codigo})
        record(results, "Check-in OK", chk.status_code == 200 and chk.json().get("ok") is True)
        dup = c.post("/api/portaria/validar", json={"evento_id": eid, "token": token, "codigo": codigo})
        record(results, "Check-in duplicado bloqueado", dup.json().get("ok") is False)

    print("\n[Segurança UI]")
    prot = httpx.get(f"{WEB}/organizador/eventos", follow_redirects=False, timeout=15)
    record(results, "Bloqueio /organizador sem login", "/auth" in (prot.headers.get("location") or ""))
    record(results, "Proxy admin sem cookie", httpx.get(f"{WEB}/api/admin/proxy/setup", timeout=15).status_code == 401)

    c.close()
    ok_n = sum(1 for _, ok, _ in results if ok)
    print(f"\n{'='*60}\nResultado API: {ok_n}/{len(results)} passou")
    print(f"Organizador: {org_email} / {senha}")
    print(f"Cliente: {cli_email} / {senha}")
    print(f"Evento: http://localhost:3000/eventos/{slug}")
    return 0 if ok_n == len(results) else 1


if __name__ == "__main__":
    raise SystemExit(main())
