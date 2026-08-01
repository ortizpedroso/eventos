"""PDV / venda presencial MVP."""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path
from unittest.mock import patch

from tests.test_api import TestingSessionLocal, client

PDV_UI = Path("frontend/src/app/organizador/eventos/[id]/pdv/pdv-presencial-client.tsx").read_text(
    encoding="utf-8"
)
LISTAGEM = Path("frontend/src/app/organizador/eventos/organizador-eventos-client.tsx").read_text(
    encoding="utf-8"
)


def _agora():
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _registrar(tipo: str, suf: str) -> tuple[str, str]:
    email = f"{tipo}.pdv.{suf}@test.com"
    r = client.post(
        "/api/auth/registrar",
        json={"email": email, "senha": "senha12345", "nome": tipo, "tipo": tipo},
    )
    assert r.status_code in (200, 201), r.text
    return r.json()["access_token"], email


def _criar_evento(tok: str, email: str, **extra) -> dict:
    payload = {
        "nome": f"Show PDV {uuid.uuid4().hex[:6]}",
        "descricao": "Evento PDV",
        "data_inicio": (_agora() + timedelta(days=5)).isoformat(),
        "data_fim": (_agora() + timedelta(days=5, hours=3)).isoformat(),
        "local": "Arena",
        "cidade": "SP",
        "contato_telefone": "11999998888",
        "contato_email": email,
        "preco_ingresso": 50.0,
        "categoria": "Música",
        "publicado": True,
        "ingresso_lotes": [
            {
                "nome": "Pista",
                "preco": 50.0,
                "ordem": 1,
                "ativo": True,
                "quantidade_maxima": 2,
            }
        ],
    }
    payload.update(extra)
    r = client.post(
        "/api/eventos/criar",
        headers={"Authorization": f"Bearer {tok}"},
        json=payload,
    )
    assert r.status_code == 200, r.text
    return r.json()


def test_ui_pdv_link_na_listagem():
    assert "/pdv" in LISTAGEM
    assert "PDV" in LISTAGEM
    assert "Confirmar venda presencial" in PDV_UI
    assert "forma_pagamento" in PDV_UI


def test_pdv_so_dono_acessa():
    suf = uuid.uuid4().hex[:8]
    tok_a, email_a = _registrar("organizador", f"a{suf}")
    tok_b, _ = _registrar("organizador", f"b{suf}")
    ev = _criar_evento(tok_a, email_a)
    lote_id = ev["ingresso_lotes"][0]["id"]

    r = client.post(
        f"/api/eventos/id/{ev['id']}/pdv",
        headers={"Authorization": f"Bearer {tok_b}"},
        json={
            "lote_id": lote_id,
            "participante_nome": "Intruso",
            "participante_email": f"intruso.{suf}@test.com",
            "forma_pagamento": "dinheiro",
        },
    )
    assert r.status_code == 404, r.text

    tok_cli, _ = _registrar("cliente", f"c{suf}")
    r2 = client.post(
        f"/api/eventos/id/{ev['id']}/pdv",
        headers={"Authorization": f"Bearer {tok_cli}"},
        json={
            "lote_id": lote_id,
            "participante_nome": "Cliente",
            "participante_email": f"cliente.{suf}@test.com",
            "forma_pagamento": "dinheiro",
        },
    )
    assert r2.status_code == 403, r2.text


def test_pdv_respeita_limite_lote_e_gera_pago():
    suf = uuid.uuid4().hex[:8]
    tok, email = _registrar("organizador", suf)
    ev = _criar_evento(tok, email)
    lote_id = ev["ingresso_lotes"][0]["id"]
    headers = {"Authorization": f"Bearer {tok}"}

    for i in range(2):
        r = client.post(
            f"/api/eventos/id/{ev['id']}/pdv",
            headers=headers,
            json={
                "lote_id": lote_id,
                "participante_nome": f"Pessoa {i}",
                "participante_email": f"p{i}.{suf}@test.com",
                "forma_pagamento": "dinheiro",
            },
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["status"] == "pago"
        assert body["canal_venda"] == "pdv"
        assert body["forma_pagamento_pdv"] == "dinheiro"

    r3 = client.post(
        f"/api/eventos/id/{ev['id']}/pdv",
        headers=headers,
        json={
            "lote_id": lote_id,
            "participante_nome": "Extra",
            "participante_email": f"extra.{suf}@test.com",
            "forma_pagamento": "cartao",
        },
    )
    assert r3.status_code == 400, r3.text
    assert "esgotad" in r3.json()["detail"].lower() or "vaga" in r3.json()["detail"].lower()

    # Aparece no relatório do organizador
    rel = client.get("/api/relatorios/organizador/participantes", headers=headers)
    assert rel.status_code == 200, rel.text
    nomes = {p["participante_nome"] for p in rel.json()["participantes"]}
    assert "Pessoa 0" in nomes
    assert "Pessoa 1" in nomes
    canais = {p.get("canal_venda") for p in rel.json()["participantes"]}
    assert "pdv" in canais


def test_pdv_exige_email():
    suf = uuid.uuid4().hex[:8]
    tok, email = _registrar("organizador", suf)
    ev = _criar_evento(tok, email)
    lote_id = ev["ingresso_lotes"][0]["id"]
    headers = {"Authorization": f"Bearer {tok}"}

    r = client.post(
        f"/api/eventos/id/{ev['id']}/pdv",
        headers=headers,
        json={
            "lote_id": lote_id,
            "participante_nome": "Sem Email",
            "forma_pagamento": "dinheiro",
        },
    )
    assert r.status_code == 422, r.text

    r2 = client.post(
        f"/api/eventos/id/{ev['id']}/pdv",
        headers=headers,
        json={
            "lote_id": lote_id,
            "participante_nome": "Email Invalido",
            "participante_email": "nao-e-email",
            "forma_pagamento": "dinheiro",
        },
    )
    assert r2.status_code == 400, r2.text
    assert "e-mail" in r2.json()["detail"].lower()


def test_pdv_envia_email_do_ingresso_ao_vender():
    suf = uuid.uuid4().hex[:8]
    tok, email = _registrar("organizador", suf)
    ev = _criar_evento(tok, email)
    lote_id = ev["ingresso_lotes"][0]["id"]
    headers = {"Authorization": f"Bearer {tok}"}

    with patch("app.services.pdv_presencial.enqueue_ticket_email") as mock_enqueue:
        r = client.post(
            f"/api/eventos/id/{ev['id']}/pdv",
            headers=headers,
            json={
                "lote_id": lote_id,
                "participante_nome": "Comprador PDV",
                "participante_email": f"comprador.{suf}@test.com",
                "forma_pagamento": "dinheiro",
            },
        )
    assert r.status_code == 200, r.text
    mock_enqueue.assert_called_once_with(r.json()["ingresso_id"])


def test_pdv_com_email_novo_cria_conta_cliente_propria_nao_do_organizador():
    from app.models import Ingresso, Usuario

    suf = uuid.uuid4().hex[:8]
    tok, email = _registrar("organizador", suf)
    ev = _criar_evento(tok, email)
    lote_id = ev["ingresso_lotes"][0]["id"]
    headers = {"Authorization": f"Bearer {tok}"}
    email_comprador = f"comprador.novo.{suf}@test.com"

    email_capturado: dict = {}

    def _capturar_email(*args, **kwargs):
        email_capturado["email"] = args[1].email

    with patch(
        "app.services.pdv_presencial.enviar_email_primeiro_acesso", side_effect=_capturar_email
    ) as mock_email:
        r = client.post(
            f"/api/eventos/id/{ev['id']}/pdv",
            headers=headers,
            json={
                "lote_id": lote_id,
                "participante_nome": "Comprador Novo",
                "participante_email": email_comprador,
                "forma_pagamento": "dinheiro",
            },
        )
    assert r.status_code == 200, r.text
    ingresso_id = r.json()["ingresso_id"]

    db = TestingSessionLocal()
    try:
        organizador = db.query(Usuario).filter(Usuario.email == email.lower()).first()
        comprador = db.query(Usuario).filter(Usuario.email == email_comprador.lower()).first()
        ingresso = db.get(Ingresso, ingresso_id)

        assert comprador is not None
        assert comprador.tipo == "cliente"
        assert comprador.senha_hash is None
        assert comprador.id != organizador.id
        assert ingresso.usuario_id == comprador.id
    finally:
        db.close()

    mock_email.assert_called_once()
    assert email_capturado["email"] == email_comprador.lower()


def test_pdv_com_email_de_cliente_existente_associa_conta_certa_sem_reenviar_primeiro_acesso():
    from app.models import Ingresso, Usuario

    suf = uuid.uuid4().hex[:8]
    tok, email = _registrar("organizador", suf)
    tok_cli, email_cli = _registrar("cliente", suf)
    ev = _criar_evento(tok, email)
    lote_id = ev["ingresso_lotes"][0]["id"]
    headers = {"Authorization": f"Bearer {tok}"}

    with patch("app.services.pdv_presencial.enviar_email_primeiro_acesso") as mock_email:
        r = client.post(
            f"/api/eventos/id/{ev['id']}/pdv",
            headers=headers,
            json={
                "lote_id": lote_id,
                "participante_nome": "Cliente Existente",
                "participante_email": email_cli,
                "forma_pagamento": "dinheiro",
            },
        )
    assert r.status_code == 200, r.text
    ingresso_id = r.json()["ingresso_id"]

    db = TestingSessionLocal()
    try:
        comprador = db.query(Usuario).filter(Usuario.email == email_cli.lower()).first()
        ingresso = db.get(Ingresso, ingresso_id)
        assert ingresso.usuario_id == comprador.id
    finally:
        db.close()

    mock_email.assert_not_called()


def test_pdv_com_email_de_conta_desativada_retorna_erro():
    from app.models import Usuario

    suf = uuid.uuid4().hex[:8]
    tok, email = _registrar("organizador", suf)
    tok_cli, email_cli = _registrar("cliente", suf)
    ev = _criar_evento(tok, email)
    lote_id = ev["ingresso_lotes"][0]["id"]
    headers = {"Authorization": f"Bearer {tok}"}

    db = TestingSessionLocal()
    try:
        u = db.query(Usuario).filter(Usuario.email == email_cli.lower()).first()
        u.ativo = False
        db.commit()
    finally:
        db.close()

    r = client.post(
        f"/api/eventos/id/{ev['id']}/pdv",
        headers=headers,
        json={
            "lote_id": lote_id,
            "participante_nome": "Conta Desativada",
            "participante_email": email_cli,
            "forma_pagamento": "dinheiro",
        },
    )
    assert r.status_code == 400, r.text
    assert "desativad" in r.json()["detail"].lower()
