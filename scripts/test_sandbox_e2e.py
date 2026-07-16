#!/usr/bin/env python3
"""Teste E2E sandbox Asaas: compra PIX, ledger, extorno."""
from __future__ import annotations
import os, sys, time, uuid
from datetime import datetime, timedelta, timezone

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, REPO_ROOT)
os.chdir(REPO_ROOT)

import requests
from config.settings import settings

API_BASE = "http://localhost:8000"
PASS_TEST = "SandboxTest@123"
CPF_TEST = "52998224725"


def ok(m): print(f"  [OK]  {m}")
def info(m): print(f"  [--]  {m}")
def fail(m): print(f"  [FAIL]  {m}", file=sys.stderr)
def sep(t): print(f"\n=== {t} ===")


def asaas_call(method, path, body=None):
    from app.services.asaas_client import get_asaas_client
    c = get_asaas_client()
    if method == "GET":
        return c.get(path)
    return c.post(path, body or {})


def api_call(method, path, body=None, token=None):
    headers = {"Content-Type": "application/json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    url = f"{API_BASE}{path}"
    if method == "GET":
        return requests.get(url, headers=headers, timeout=30)
    if method == "PUT":
        return requests.put(url, json=body, headers=headers, timeout=30)
    return requests.post(url, json=body, headers=headers, timeout=30)


def assert_ok(r, ctx):
    assert r.status_code in (200, 201), f"{ctx}: HTTP {r.status_code} -- {r.text[:400]}"
    return r.json()


def get_db():
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker
    return sessionmaker(bind=create_engine(settings.DATABASE_URL))()


def fire_webhook(event_type, pay_id, extra=None):
    whk_token = (settings.ASAAS_WEBHOOK_TOKEN or "").strip()
    payload = {
        "id": f"evt_{uuid.uuid4().hex[:10]}",
        "event": event_type,
        "payment": {"id": pay_id, "status": "CONFIRMED", **(extra or {})},
    }
    r = requests.post(
        f"{API_BASE}/api/webhooks/asaas",
        json=payload,
        headers={"asaas-access-token": whk_token},
        timeout=30,
    )
    assert r.status_code == 200, f"Webhook {event_type}: {r.status_code} -- {r.text[:200]}"


def t1_organizador(uid, db):
    sep("1/7 -- Organizador de teste")
    from app.models import Usuario
    from app.services.auth import hash_password

    email = f"org_sb_{uid}@eventosbr.test"
    u = Usuario(
        id=str(uuid.uuid4()),
        email=email,
        nome="Org Sandbox Test",
        tipo="organizador",
        ativo=True,
        email_verificado=True,
        senha_hash=hash_password(PASS_TEST),
        asaas_repasse_status="manual",
        asaas_wallet_id=None,
    )
    db.add(u)
    db.commit()
    ok(f"Usuario criado: {email}")

    r = api_call("POST", "/api/auth/login", {"email": email, "senha": PASS_TEST})
    data = assert_ok(r, "login")
    ok("Login OK")
    return u.id, data["access_token"]


def t2_evento(uid, token, db):
    sep("2/7 -- Evento R$50")
    now = datetime.now(timezone.utc)
    payload = {
        "nome": f"Sandbox Test {uid}",
        "descricao": "Teste automatizado sandbox",
        "data_inicio": (now + timedelta(days=30)).isoformat(),
        "data_fim": (now + timedelta(days=31)).isoformat(),
        "local": "Arena Teste",
        "cidade": "Sao Paulo",
        "categoria": "Tecnologia",
        "preco_ingresso": 50.0,
        "publicado": False,
    }
    data = assert_ok(api_call("POST", "/api/eventos", payload, token=token), "criar_evento")
    ok(f"Evento criado: id={data['id']}")
    return data["id"], data.get("slug", "")


def t3_customer(uid):
    sep("3/7 -- Customer Asaas sandbox")
    resp = asaas_call("POST", "/v3/customers", {
        "name": f"Comprador Teste {uid}",
        "email": f"comprador_{uid}@sandbox.test",
        "cpfCnpj": CPF_TEST,
        "notificationDisabled": True,
    })
    cid = resp.get("id")
    assert cid, f"Customer nao criado: {resp}"
    ok(f"Customer Asaas: {cid}")
    return cid


def t4_cobranca_ingresso(uid, customer_id, evento_id, user_id, db):
    sep("4/7 -- Cobranca PIX real + ingresso pendente")
    from app.models import Ingresso

    due = (datetime.now(timezone.utc) + timedelta(days=3)).strftime("%Y-%m-%d")
    resp = asaas_call("POST", "/v3/payments", {
        "customer": customer_id,
        "billingType": "PIX",
        "value": 50.0,
        "dueDate": due,
        "description": f"Ingresso sandbox {uid}",
        "externalReference": f"sandbox_{uid}",
    })
    pay_id = resp.get("id")
    assert pay_id, f"Pagamento Asaas nao criado: {resp}"
    ok(f"Cobranca Asaas: {pay_id}")

    ing = Ingresso(
        id=str(uuid.uuid4()),
        evento_id=evento_id,
        usuario_id=user_id,
        valor=50.0,
        status="pendente",
        asaas_payment_id=pay_id,
        participante_nome="Comprador Teste",
        participante_email=f"comprador_{uid}@sandbox.test",
        data_compra=datetime.now(timezone.utc).replace(tzinfo=None),
        data_limite_cancelamento=(
            datetime.now(timezone.utc) + timedelta(days=10)
        ).replace(tzinfo=None),
    )
    db.add(ing)
    db.commit()
    ok(f"Ingresso pendente: {ing.id}")
    return pay_id, ing.id


def t5_webhook_confirmado(pay_id, customer_id):
    sep("5/7 -- Webhook PAYMENT_CONFIRMED")
    fire_webhook("PAYMENT_CONFIRMED", pay_id, {
        "status": "CONFIRMED",
        "value": 50.0,
        "customer": customer_id,
        "billingType": "PIX",
        "paymentDate": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
    })
    time.sleep(0.5)
    ok("Webhook PAYMENT_CONFIRMED enviado")


def t6_ledger(ingresso_id, db):
    sep("6/7 -- Ingresso pago + ledger")
    from app.models import Ingresso

    db.expire_all()
    ing = db.get(Ingresso, ingresso_id)
    assert ing and ing.status == "pago", (
        f"Status esperado=pago, obtido={ing.status if ing else 'not found'}"
    )
    assert ing.pago_em is not None, "pago_em nao definido"

    valor = float(ing.valor or 0)
    taxa = float(ing.taxa_plataforma_aplicada or 0)
    liquido = float(ing.liquido_repassado or 0)

    print(f"       Valor:        R$ {valor:.2f}")
    print(f"       Plataforma:   R$ {taxa:.2f}  ({100*taxa/valor:.1f}%)")
    print(f"       Organizador:  R$ {liquido:.2f}")

    assert taxa > 0, f"taxa_plataforma_aplicada deve ser > 0, obtido {taxa}"
    assert liquido >= 0, f"liquido_repassado deve ser >= 0, obtido {liquido}"
    assert round(taxa + liquido, 2) <= round(valor + 0.01, 2)
    ok("Ledger validado")
    return {"taxa": taxa, "liquido": liquido, "valor": valor}


def t7_reembolso(pay_id, ingresso_id, db):
    sep("7/7 -- Reembolso (extorno)")
    try:
        resp = asaas_call("POST", f"/v3/payments/{pay_id}/refund", {"value": 50.0})
        ok(f"Reembolso Asaas API: status={resp.get('status')}")
    except Exception as e:
        info(f"Refund via API falhou ({e}) -- usando webhook simulado")

    fire_webhook("PAYMENT_REFUNDED", pay_id, {"status": "REFUNDED"})
    time.sleep(0.5)

    from app.models import Ingresso
    db.expire_all()
    ing = db.get(Ingresso, ingresso_id)
    assert ing and ing.status == "cancelado", (
        f"Status esperado=cancelado, obtido={ing.status if ing else 'not found'}"
    )
    assert ing.estornado_em is not None, "estornado_em nao definido"
    ok("Ingresso cancelado + estornado_em OK")


def main():
    uid = uuid.uuid4().hex[:8]

    assert settings.ASAAS_ENVIRONMENT == "sandbox", "Ative sandbox: ASAAS_ENVIRONMENT=sandbox"
    assert (settings.ASAAS_API_KEY or "").strip(), "ASAAS_API_KEY nao configurado"
    assert (settings.ASAAS_WEBHOOK_TOKEN or "").strip(), "ASAAS_WEBHOOK_TOKEN nao configurado"

    info(f"uid={uid}  API={API_BASE}  env={settings.ASAAS_ENVIRONMENT}")

    db = get_db()
    ledger = {}
    try:
        user_id, token = t1_organizador(uid, db)
        evento_id, slug = t2_evento(uid, token, db)
        customer_id = t3_customer(uid)
        pay_id, ingresso_id = t4_cobranca_ingresso(uid, customer_id, evento_id, user_id, db)
        t5_webhook_confirmado(pay_id, customer_id)
        ledger = t6_ledger(ingresso_id, db)
        t7_reembolso(pay_id, ingresso_id, db)
    finally:
        db.close()

    print()
    print("=" * 50)
    print("TODOS OS TESTES PASSARAM")
    print(f"  Valor:       R$ {ledger.get('valor', 0):.2f}")
    print(f"  Plataforma:  R$ {ledger.get('taxa', 0):.2f}")
    print(f"  Organizador: R$ {ledger.get('liquido', 0):.2f}")
    print("=" * 50)


if __name__ == "__main__":
    try:
        main()
    except AssertionError as e:
        fail(str(e))
        sys.exit(1)
    except Exception:
        import traceback
        traceback.print_exc()
        sys.exit(1)