"""Self-service: comprador vincula ingresso à conta via código da carteirinha."""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from unittest.mock import patch

from app.models import Ingresso, Usuario
from app.services.ingresso_checkin import codigo_checkin
from tests.test_api import TestingSessionLocal, client

INGRESSOS_UI = __import__("pathlib").Path(
    "frontend/src/app/conta/ingressos/ingressos-client.tsx"
).read_text(encoding="utf-8")


def _agora():
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _registrar(tipo: str, suf: str, email: str | None = None) -> tuple[str, str]:
    addr = email or f"{tipo}.vinc.{suf}@test.com"
    r = client.post(
        "/api/auth/registrar",
        json={"email": addr, "senha": "senha12345", "nome": tipo, "tipo": tipo},
    )
    assert r.status_code in (200, 201), r.text
    return r.json()["access_token"], addr.lower()


def _criar_evento(tok: str, email: str) -> dict:
    r = client.post(
        "/api/eventos/criar",
        headers={"Authorization": f"Bearer {tok}"},
        json={
            "nome": f"Show Vinc {uuid.uuid4().hex[:6]}",
            "descricao": "Evento vincular ingresso",
            "data_inicio": (_agora() + timedelta(days=5)).isoformat(),
            "data_fim": (_agora() + timedelta(days=5, hours=3)).isoformat(),
            "local": "Arena",
            "cidade": "SP",
            "contato_telefone": "11999998888",
            "contato_email": email,
            "preco_ingresso": 40.0,
            "categoria": "Música",
            "publicado": True,
            "ingresso_lotes": [
                {
                    "nome": "Pista",
                    "preco": 40.0,
                    "ordem": 1,
                    "ativo": True,
                    "quantidade_maxima": 5,
                }
            ],
        },
    )
    assert r.status_code == 200, r.text
    return r.json()


def _vender_pdv(tok: str, ev: dict, email_comprador: str) -> dict:
    lote_id = ev["ingresso_lotes"][0]["id"]
    with patch("app.services.pdv_presencial.send_ticket_email_sync", return_value=True):
        with patch("app.services.pdv_presencial.enqueue_ticket_email"):
            r = client.post(
                f"/api/eventos/id/{ev['id']}/pdv",
                headers={"Authorization": f"Bearer {tok}"},
                json={
                    "lote_id": lote_id,
                    "participante_nome": "Maria Silva",
                    "participante_email": email_comprador,
                    "participante_telefone": "11987654321",
                    "forma_pagamento": "dinheiro",
                },
            )
    assert r.status_code == 200, r.text
    return r.json()


def test_ui_vincular_ingresso():
    assert "Vincular ingresso" in INGRESSOS_UI
    assert "/api/ingressos/vincular" in INGRESSOS_UI


def test_vincular_ingresso_self_service():
    suf = uuid.uuid4().hex[:8]
    org_tok, org_email = _registrar("organizador", suf)
    comprador_email = f"maria.vinc.{suf}@test.com"
    comprador_tok, _ = _registrar("cliente", suf, comprador_email)

    ev = _criar_evento(org_tok, org_email)
    venda = _vender_pdv(org_tok, ev, comprador_email)
    ingresso_id = venda["ingresso_id"]
    codigo = codigo_checkin(ingresso_id)

    db = TestingSessionLocal()
    try:
        ingresso = db.get(Ingresso, ingresso_id)
        organizador = db.query(Usuario).filter(Usuario.email == org_email).first()
        assert organizador is not None
        ingresso.usuario_id = organizador.id
        db.commit()
    finally:
        db.close()

    r = client.post(
        "/api/ingressos/vincular",
        headers={"Authorization": f"Bearer {comprador_tok}"},
        json={"codigo": codigo},
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["ingresso_id"] == ingresso_id
    assert body["ja_vinculado"] is False

    db = TestingSessionLocal()
    try:
        ingresso = db.get(Ingresso, ingresso_id)
        comprador = db.query(Usuario).filter(Usuario.email == comprador_email).first()
        assert ingresso.usuario_id == comprador.id
    finally:
        db.close()

    meus = client.get(
        "/api/ingressos/meus",
        headers={"Authorization": f"Bearer {comprador_tok}"},
    )
    assert meus.status_code == 200
    ids = [i["id"] for i in meus.json()]
    assert ingresso_id in ids


def test_vincular_ingresso_email_diferente_bloqueado():
    suf = uuid.uuid4().hex[:8]
    org_tok, org_email = _registrar("organizador", suf)
    comprador_tok, _ = _registrar("cliente", suf, f"outro.{suf}@test.com")

    ev = _criar_evento(org_tok, org_email)
    email_ticket = f"ticket.{suf}@test.com"
    venda = _vender_pdv(org_tok, ev, email_ticket)
    codigo = codigo_checkin(venda["ingresso_id"])

    r = client.post(
        "/api/ingressos/vincular",
        headers={"Authorization": f"Bearer {comprador_tok}"},
        json={"codigo": codigo},
    )
    assert r.status_code == 400
    assert "e-mail" in r.json()["detail"].lower()


def test_vincular_ingresso_codigo_invalido():
    suf = uuid.uuid4().hex[:8]
    tok, _ = _registrar("cliente", suf)

    r = client.post(
        "/api/ingressos/vincular",
        headers={"Authorization": f"Bearer {tok}"},
        json={"codigo": "EBR1:fake:invalidsig"},
    )
    assert r.status_code == 400
