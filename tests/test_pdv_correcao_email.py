"""Correção de e-mail / reenvio de ingressos PDV."""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from unittest.mock import patch

from tests.test_api import TestingSessionLocal, client

PDV_UI = __import__("pathlib").Path(
    "frontend/src/app/organizador/eventos/[id]/pdv/pdv-presencial-client.tsx"
).read_text(encoding="utf-8")


def _agora():
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _registrar(tipo: str, suf: str) -> tuple[str, str]:
    email = f"{tipo}.corr.{suf}@test.com"
    r = client.post(
        "/api/auth/registrar",
        json={"email": email, "senha": "senha12345", "nome": tipo, "tipo": tipo},
    )
    assert r.status_code in (200, 201), r.text
    return r.json()["access_token"], email


def _criar_evento(tok: str, email: str) -> dict:
    r = client.post(
        "/api/eventos/criar",
        headers={"Authorization": f"Bearer {tok}"},
        json={
            "nome": f"Show Corr {uuid.uuid4().hex[:6]}",
            "descricao": "Evento correção PDV",
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


def _vender_pdv(tok: str, ev: dict, **extra) -> dict:
    lote_id = ev["ingresso_lotes"][0]["id"]
    body = {
        "lote_id": lote_id,
        "participante_nome": "Maria Silva",
        "participante_email": f"errado.{uuid.uuid4().hex[:6]}@test.com",
        "participante_telefone": "11987654321",
        "forma_pagamento": "dinheiro",
    }
    body.update(extra)
    with patch("app.services.pdv_presencial.send_ticket_email_sync", return_value=True):
        with patch("app.services.pdv_presencial.enqueue_ticket_email"):
            r = client.post(
                f"/api/eventos/id/{ev['id']}/pdv",
                headers={"Authorization": f"Bearer {tok}"},
                json=body,
            )
    assert r.status_code == 200, r.text
    return r.json()


def test_ui_pdv_confirmacao_email_e_correcao():
    assert "Confirme o e-mail" in PDV_UI
    assert "Corrigir venda" in PDV_UI
    assert "Reenviar ingresso" in PDV_UI
    assert "pdv/vendas/buscar" in PDV_UI


def test_correcao_email_reassocia_conta_e_lista_na_conta_certa():
    from app.models import Ingresso, Usuario

    suf = uuid.uuid4().hex[:8]
    tok, org_email = _registrar("organizador", suf)
    ev = _criar_evento(tok, org_email)
    venda = _vender_pdv(tok, ev)
    ingresso_id = venda["ingresso_id"]
    email_errado = venda["participante_email"]
    email_certo = f"maria.certa.{suf}@test.com"

    r = client.patch(
        f"/api/eventos/id/{ev['id']}/pdv/vendas/{ingresso_id}",
        headers={"Authorization": f"Bearer {tok}"},
        json={
            "participante_nome": "Maria Silva",
            "participante_email": email_certo,
            "participante_telefone": "11987654321",
        },
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["participante_email"] == email_certo.lower()

    db = TestingSessionLocal()
    try:
        ingresso = db.get(Ingresso, ingresso_id)
        comprador = db.query(Usuario).filter(Usuario.email == email_certo.lower()).first()
        assert comprador is not None
        assert ingresso.usuario_id == comprador.id
        assert ingresso.participante_email == email_certo.lower()
        fantasma = db.query(Usuario).filter(Usuario.email == email_errado.lower()).first()
        assert fantasma is not None
        assert fantasma.id != comprador.id
        comprador_id = comprador.id
    finally:
        db.close()

    from app.services.auth import create_access_token

    token_comprador = create_access_token({"sub": comprador_id})
    r3 = client.get(
        "/api/ingressos/meus",
        headers={"Authorization": f"Bearer {token_comprador}"},
    )
    assert r3.status_code == 200, r3.text
    ids = [i["id"] for i in r3.json()]
    assert ingresso_id in ids


def test_buscar_venda_pdv_por_telefone():
    suf = uuid.uuid4().hex[:8]
    tok, org_email = _registrar("organizador", suf)
    ev = _criar_evento(tok, org_email)
    _vender_pdv(tok, ev, participante_telefone="11999887766")

    r = client.get(
        f"/api/eventos/id/{ev['id']}/pdv/vendas/buscar?q=99887766",
        headers={"Authorization": f"Bearer {tok}"},
    )
    assert r.status_code == 200, r.text
    assert len(r.json()["resultados"]) >= 1
    assert any("99887766" in (x.get("participante_telefone") or "") for x in r.json()["resultados"])


def test_reenviar_email_venda_pdv():
    suf = uuid.uuid4().hex[:8]
    tok, org_email = _registrar("organizador", suf)
    ev = _criar_evento(tok, org_email)
    venda = _vender_pdv(tok, ev)
    ingresso_id = venda["ingresso_id"]

    with patch("app.services.pdv_correcao.send_ticket_email_sync", return_value=True) as mock_sync:
        r = client.post(
            f"/api/eventos/id/{ev['id']}/pdv/vendas/{ingresso_id}/reenviar-email",
            headers={"Authorization": f"Bearer {tok}"},
        )
    assert r.status_code == 200, r.text
    assert r.json()["email_enviado_sync"] is True
    mock_sync.assert_called_once_with(ingresso_id)


def test_buscar_vendas_pdv_so_dono():
    suf = uuid.uuid4().hex[:8]
    tok_a, email_a = _registrar("organizador", f"a{suf}")
    tok_b, _ = _registrar("organizador", f"b{suf}")
    ev = _criar_evento(tok_a, email_a)
    _vender_pdv(tok_a, ev, participante_nome="Busca Teste", participante_telefone="11999001122")

    r = client.get(
        f"/api/eventos/id/{ev['id']}/pdv/vendas/buscar?q=Busca",
        headers={"Authorization": f"Bearer {tok_b}"},
    )
    assert r.status_code == 404, r.text


def test_correcao_pdv_so_dono():
    suf = uuid.uuid4().hex[:8]
    tok_a, email_a = _registrar("organizador", f"a{suf}")
    tok_b, _ = _registrar("organizador", f"b{suf}")
    ev = _criar_evento(tok_a, email_a)
    venda = _vender_pdv(tok_a, ev)

    r = client.patch(
        f"/api/eventos/id/{ev['id']}/pdv/vendas/{venda['ingresso_id']}",
        headers={"Authorization": f"Bearer {tok_b}"},
        json={
            "participante_nome": "Hack",
            "participante_email": "hack@test.com",
        },
    )
    assert r.status_code == 404, r.text
