"""Duplicar evento (API existente + UI) e deletar com regra de segurança."""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path

from app.models import Ingresso
from tests import test_api
from tests.test_api import client

LISTAGEM = Path("frontend/src/app/organizador/eventos/organizador-eventos-client.tsx").read_text(
    encoding="utf-8"
)


def _agora():
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _registrar(tipo: str, suf: str) -> str:
    r = client.post(
        "/api/auth/registrar",
        json={
            "email": f"{tipo}.dupdel.{suf}@test.com",
            "senha": "senha12345",
            "nome": tipo,
            "tipo": tipo,
        },
    )
    assert r.status_code in (200, 201), r.text
    return r.json()["access_token"]


def _criar_evento(org_token: str, email: str, **extra) -> dict:
    payload = {
        "nome": f"Festa Dup {uuid.uuid4().hex[:6]}",
        "descricao": "Descrição original para copiar",
        "data_inicio": (_agora() + timedelta(days=10)).isoformat(),
        "data_fim": (_agora() + timedelta(days=10, hours=4)).isoformat(),
        "local": "Club Central",
        "cidade": "Rio",
        "contato_telefone": "21988776655",
        "contato_email": email,
        "preco_ingresso": 80.0,
        "categoria": "Festas e Baladas",
        "publicado": True,
        "ingresso_lotes": [
            {"nome": "Pista", "preco": 80.0, "ordem": 1, "ativo": True},
            {"nome": "VIP", "preco": 150.0, "ordem": 2, "ativo": True},
        ],
    }
    payload.update(extra)
    r = client.post(
        "/api/eventos/criar",
        headers={"Authorization": f"Bearer {org_token}"},
        json=payload,
    )
    assert r.status_code == 200, r.text
    return r.json()


def test_duplicar_copia_dados_slug_novo_e_despublicado():
    suf = uuid.uuid4().hex[:8]
    tok = _registrar("organizador", suf)
    email = f"organizador.dupdel.{suf}@test.com"
    ev = _criar_evento(tok, email, classificacao_etaria="18+", o_que_levar="Documento")
    headers = {"Authorization": f"Bearer {tok}"}

    r = client.post(f"/api/eventos/id/{ev['id']}/duplicar", headers=headers)
    assert r.status_code == 200, r.text
    copia = r.json()
    assert copia["id"] != ev["id"]
    assert copia["slug"] != ev["slug"]
    assert copia["publicado"] is False
    assert copia["descricao"] == ev["descricao"]
    assert "(cópia)" in copia["nome"]
    assert len(copia.get("ingresso_lotes") or []) == 2
    nomes = {l["nome"] for l in copia["ingresso_lotes"]}
    assert nomes == {"Pista", "VIP"}
    assert copia.get("classificacao_etaria") == "18+"
    assert copia.get("o_que_levar") == "Documento"

    assert "Duplicar" in LISTAGEM
    assert "/duplicar" in LISTAGEM
    assert "/editar" in LISTAGEM


def test_deletar_evento_sem_vendas_ok():
    suf = uuid.uuid4().hex[:8]
    tok = _registrar("organizador", suf)
    email = f"organizador.dupdel.{suf}@test.com"
    ev = _criar_evento(tok, email, publicado=False)
    headers = {"Authorization": f"Bearer {tok}"}

    r = client.delete(f"/api/eventos/id/{ev['id']}", headers=headers)
    assert r.status_code == 200, r.text
    assert r.json().get("ok") is True

    gone = client.get(f"/api/eventos/id/{ev['id']}/resumo", headers=headers)
    assert gone.status_code == 404


def test_deletar_evento_com_ingresso_pago_bloqueado():
    suf = uuid.uuid4().hex[:8]
    tok = _registrar("organizador", suf)
    email = f"organizador.dupdel.{suf}@test.com"
    ev = _criar_evento(tok, email)
    headers = {"Authorization": f"Bearer {tok}"}

    db = test_api.TestingSessionLocal()
    try:
        from app.models import Usuario

        buyer = Usuario(
            email=f"buy.dupdel.{suf}@test.com",
            nome="Buyer",
            senha_hash="x",
            tipo="cliente",
        )
        db.add(buyer)
        db.commit()
        db.refresh(buyer)
        db.add(
            Ingresso(
                evento_id=ev["id"],
                usuario_id=buyer.id,
                valor=80.0,
                status="pago",
                participante_email=buyer.email,
            )
        )
        db.commit()
    finally:
        db.close()

    r = client.delete(f"/api/eventos/id/{ev['id']}", headers=headers)
    assert r.status_code == 400, r.text
    detail = r.json()["detail"].lower()
    assert "deletar" in detail or "não é possível" in detail
    assert "despubli" in detail or "pause" in detail or "vitrine" in detail

    ainda = client.get(f"/api/eventos/id/{ev['id']}/resumo", headers=headers)
    assert ainda.status_code == 200


def test_deletar_evento_com_ingresso_pendente_bloqueado():
    suf = uuid.uuid4().hex[:8]
    tok = _registrar("organizador", suf)
    email = f"organizador.dupdel.{suf}@test.com"
    ev = _criar_evento(tok, email)
    headers = {"Authorization": f"Bearer {tok}"}

    db = test_api.TestingSessionLocal()
    try:
        from app.models import Usuario

        buyer = Usuario(
            email=f"buy2.dupdel.{suf}@test.com",
            nome="Buyer2",
            senha_hash="x",
            tipo="cliente",
        )
        db.add(buyer)
        db.commit()
        db.refresh(buyer)
        db.add(
            Ingresso(
                evento_id=ev["id"],
                usuario_id=buyer.id,
                valor=80.0,
                status="pendente",
                participante_email=buyer.email,
                reservado_ate=_agora() + timedelta(minutes=30),
            )
        )
        db.commit()
    finally:
        db.close()

    r = client.delete(f"/api/eventos/id/{ev['id']}", headers=headers)
    assert r.status_code == 400, r.text


def test_deletar_evento_com_ingresso_usado_bloqueado():
    """L1: ingresso com check-in feito (status=usado) também deve bloquear —
    já foi comparecido de verdade, apagar o evento destruiria esse registro."""
    suf = uuid.uuid4().hex[:8]
    tok = _registrar("organizador", suf)
    email = f"organizador.dupdel.{suf}@test.com"
    ev = _criar_evento(tok, email)
    headers = {"Authorization": f"Bearer {tok}"}

    db = test_api.TestingSessionLocal()
    try:
        from app.models import Usuario

        buyer = Usuario(
            email=f"buy3.dupdel.{suf}@test.com",
            nome="Buyer3",
            senha_hash="x",
            tipo="cliente",
        )
        db.add(buyer)
        db.commit()
        db.refresh(buyer)
        db.add(
            Ingresso(
                evento_id=ev["id"],
                usuario_id=buyer.id,
                valor=80.0,
                status="usado",
                participante_email=buyer.email,
            )
        )
        db.commit()
    finally:
        db.close()

    r = client.delete(f"/api/eventos/id/{ev['id']}", headers=headers)
    assert r.status_code == 400, r.text
    detail = r.json()["detail"].lower()
    assert "usado" in detail or "check-in" in detail

    ainda = client.get(f"/api/eventos/id/{ev['id']}/resumo", headers=headers)
    assert ainda.status_code == 200


def test_deletar_outro_organizador_negado():
    suf = uuid.uuid4().hex[:8]
    tok_a = _registrar("organizador", f"a{suf}")
    tok_b = _registrar("organizador", f"b{suf}")
    email_a = f"organizador.dupdel.a{suf}@test.com"
    ev = _criar_evento(tok_a, email_a, publicado=False)
    r = client.delete(
        f"/api/eventos/id/{ev['id']}",
        headers={"Authorization": f"Bearer {tok_b}"},
    )
    assert r.status_code in (403, 404)


def test_ui_listagem_tem_deletar_com_confirmacao_e_desabilitado_com_vendas():
    assert "Deletar" in LISTAGEM
    assert "Tem certeza" in LISTAGEM
    assert "ingressos_pagos" in LISTAGEM
    assert "ingressos_pendentes" in LISTAGEM
    assert "cursor-not-allowed" in LISTAGEM or "disabled" in LISTAGEM
