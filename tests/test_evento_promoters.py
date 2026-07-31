"""Promoters / links ?ref= — atribuição sem comissão."""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path
from unittest.mock import patch

from config.settings import settings

from app.models import Evento, Ingresso, Usuario
from app.services.evento_promoters import (
    criar_promoter,
    listar_promoters_com_metricas,
    resolver_promoter_ativo,
)
from tests import test_api
from tests.test_api import client

PROMOTER_REF_TS = Path("frontend/src/lib/promoter-ref.ts").read_text(encoding="utf-8")
COMPARTILHAR_TSX = Path("frontend/src/components/evento-compartilhar.tsx").read_text(encoding="utf-8")
COMPRAR_TSX = Path("frontend/src/components/comprar-ingresso.tsx").read_text(encoding="utf-8")


def _agora():
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _org_evento(db):
    org = Usuario(
        email=f"org.prom@{datetime.now().timestamp()}@test.com".replace("@@", "@"),
        nome="Org Prom",
        senha_hash="x",
        tipo="organizador",
    )
    # email único simples
    org.email = f"org.prom.{org.id or 'x'}@test.com"
    db.add(org)
    db.commit()
    db.refresh(org)
    org.email = f"org.prom.{org.id[:8]}@test.com"
    db.commit()
    agora = _agora()
    ev = Evento(
        nome="Evento Promoter",
        descricao="d",
        data_inicio=agora + timedelta(days=7),
        data_fim=agora + timedelta(days=7, hours=3),
        local="Hall",
        cidade="RJ",
        categoria="Festas e Baladas",
        preco_ingresso=40.0,
        organizador_id=org.id,
        slug=f"evento-prom-{org.id[:8]}",
        publicado=True,
    )
    db.add(ev)
    db.commit()
    db.refresh(ev)
    return org, ev


def test_resolver_promoter_ativo_case_insensitive():
    db = test_api.TestingSessionLocal()
    try:
        org, ev = _org_evento(db)
        p = criar_promoter(db, ev, codigo="Influencer1", rotulo="Ana")
        assert resolver_promoter_ativo(db, ev.id, "influencer1").id == p.id
        assert resolver_promoter_ativo(db, ev.id, "INFLUENCER1").id == p.id
        assert resolver_promoter_ativo(db, ev.id, "outro") is None
        p.ativo = False
        db.commit()
        assert resolver_promoter_ativo(db, ev.id, "Influencer1") is None
    finally:
        db.close()


def test_metricas_so_contam_pago_sem_pii():
    db = test_api.TestingSessionLocal()
    try:
        org, ev = _org_evento(db)
        p = criar_promoter(db, ev, codigo="linkA")
        buyer = Usuario(
            email=f"buy.{org.id[:6]}@test.com",
            nome="Comprador Secreto",
            senha_hash="x",
            tipo="cliente",
        )
        db.add(buyer)
        db.commit()
        db.refresh(buyer)
        agora = _agora()
        db.add(
            Ingresso(
                evento_id=ev.id,
                usuario_id=buyer.id,
                participante_nome="Comprador Secreto",
                participante_email="secreto@test.com",
                valor=40.0,
                status="pago",
                promoter_id=p.id,
                promoter_codigo=p.codigo,
                pago_em=agora,
            )
        )
        db.add(
            Ingresso(
                evento_id=ev.id,
                usuario_id=buyer.id,
                valor=40.0,
                status="pendente",
                promoter_id=p.id,
                promoter_codigo=p.codigo,
            )
        )
        db.commit()
        metricas = listar_promoters_com_metricas(db, ev)
        assert len(metricas) == 1
        m = metricas[0]
        assert m["vendas"] == 1
        assert m["receita_bruta"] == 40.0
        blob = str(m)
        assert "secreto@test.com" not in blob
        assert "Comprador Secreto" not in blob
    finally:
        db.close()


def test_api_criar_e_listar_promoters_isolamento():
    # Cadastro via API
    suf = uuid.uuid4().hex[:8]
    r = client.post(
        "/api/auth/registrar",
        json={
            "email": f"org.api.prom.{suf}@test.com",
            "senha": "senha12345",
            "nome": "Org API",
            "tipo": "organizador",
        },
    )
    assert r.status_code in (200, 201), r.text
    token = r.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # criar evento mínimo
    agora = _agora()
    er = client.post(
        "/api/eventos/criar",
        headers=headers,
        json={
            "nome": "Festa Ref",
            "descricao": "desc",
            "data_inicio": (agora + timedelta(days=5)).isoformat(),
            "local": "Club",
            "cidade": "SP",
            "contato_telefone": "11999998888",
            "contato_email": f"org.api.prom.{suf}@test.com",
            "preco_ingresso": 30.0,
            "categoria": "Festas e Baladas",
            "publicado": False,
        },
    )
    assert er.status_code == 200, er.text
    eid = er.json()["id"]

    cr = client.post(
        f"/api/eventos/id/{eid}/promoters",
        headers=headers,
        json={"codigo": "meuRef1", "rotulo": "Parceiro"},
    )
    assert cr.status_code == 200, cr.text
    assert cr.json()["codigo"] == "meuRef1"

    lr = client.get(f"/api/eventos/id/{eid}/promoters", headers=headers)
    assert lr.status_code == 200
    assert len(lr.json()["promoters"]) == 1
    assert lr.json()["promoters"][0]["vendas"] == 0


def _registrar(tipo: str, suf: str) -> str:
    r = client.post(
        "/api/auth/registrar",
        json={
            "email": f"{tipo}.prom.{suf}@test.com",
            "senha": "senha12345",
            "nome": tipo,
            "tipo": tipo,
        },
    )
    assert r.status_code in (200, 201), r.text
    return r.json()["access_token"]


def _criar_evento_api(org_token: str, email: str, *, nome: str = "Evento Ref") -> dict:
    agora = _agora()
    er = client.post(
        "/api/eventos/criar",
        headers={"Authorization": f"Bearer {org_token}"},
        json={
            "nome": nome,
            "descricao": "desc",
            "data_inicio": (agora + timedelta(days=6)).isoformat(),
            "local": "Club",
            "cidade": "SP",
            "contato_telefone": "11999998888",
            "contato_email": email,
            "preco_ingresso": 40.0,
            "categoria": "Festas e Baladas",
            "publicado": True,
            "ingresso_lotes": [{"nome": "Geral", "preco": 40.0, "ordem": 1, "ativo": True}],
        },
    )
    assert er.status_code == 200, er.text
    return er.json()


def test_pagamentos_criar_com_ref_atribui_promoter_id():
    """B1: POST /pagamentos/criar com ref válido → promoter_id; inválido/inativo/outro/sem → None."""
    suf = uuid.uuid4().hex[:8]
    org_tok = _registrar("organizador", f"a{suf}")
    org_email = f"organizador.prom.a{suf}@test.com"
    cli_tok = _registrar("cliente", f"c{suf}")
    ev = _criar_evento_api(org_tok, org_email, nome="Show Ref A")
    ev_outro = _criar_evento_api(org_tok, org_email, nome="Show Ref Outro")

    headers_org = {"Authorization": f"Bearer {org_tok}"}
    p_ok = client.post(
        f"/api/eventos/id/{ev['id']}/promoters",
        headers=headers_org,
        json={"codigo": "refValido1", "rotulo": "Ana"},
    )
    assert p_ok.status_code == 200, p_ok.text
    promoter_id = p_ok.json()["id"]

    p_inativo = client.post(
        f"/api/eventos/id/{ev['id']}/promoters",
        headers=headers_org,
        json={"codigo": "refOff1", "rotulo": "Off"},
    )
    assert p_inativo.status_code == 200, p_inativo.text
    pid_off = p_inativo.json()["id"]
    client.patch(
        f"/api/eventos/id/{ev['id']}/promoters/{pid_off}",
        headers=headers_org,
        json={"ativo": False},
    )

    p_outro = client.post(
        f"/api/eventos/id/{ev_outro['id']}/promoters",
        headers=headers_org,
        json={"codigo": "refOutroEvt", "rotulo": "Outro"},
    )
    assert p_outro.status_code == 200, p_outro.text

    headers_cli = {"Authorization": f"Bearer {cli_tok}"}
    base_body = {
        "evento_id": ev["id"],
        "valor_centavos": 4000,
        "participante_nome": "Buyer",
        "participante_email": f"buyer.prom.{suf}@test.com",
        "participante_cpf": "52998224725",
        "participante_telefone": "11999999999",
        "termo_compra_aceito": True,
    }

    prev = settings.ASAAS_DISABLED
    settings.ASAAS_DISABLED = True
    try:
        with patch("app.routes.pagamentos.enqueue_ticket_email"):
            r_ok = client.post(
                "/api/pagamentos/criar",
                headers=headers_cli,
                json={**base_body, "ref": "refValido1"},
            )
            assert r_ok.status_code == 200, r_ok.text
            iid_ok = r_ok.json()["ingresso_id"]

            r_inv = client.post(
                "/api/pagamentos/criar",
                headers=headers_cli,
                json={**base_body, "ref": "codigoInexistente"},
            )
            assert r_inv.status_code == 200, r_inv.text
            iid_inv = r_inv.json()["ingresso_id"]

            r_off = client.post(
                "/api/pagamentos/criar",
                headers=headers_cli,
                json={**base_body, "ref": "refOff1"},
            )
            assert r_off.status_code == 200, r_off.text
            iid_off = r_off.json()["ingresso_id"]

            r_outro = client.post(
                "/api/pagamentos/criar",
                headers=headers_cli,
                json={**base_body, "ref": "refOutroEvt"},
            )
            assert r_outro.status_code == 200, r_outro.text
            iid_outro = r_outro.json()["ingresso_id"]

            r_sem = client.post(
                "/api/pagamentos/criar",
                headers=headers_cli,
                json=base_body,
            )
            assert r_sem.status_code == 200, r_sem.text
            iid_sem = r_sem.json()["ingresso_id"]
    finally:
        settings.ASAAS_DISABLED = prev

    db = test_api.TestingSessionLocal()
    try:
        assert db.get(Ingresso, iid_ok).promoter_id == promoter_id
        assert db.get(Ingresso, iid_ok).promoter_codigo == "refValido1"
        assert db.get(Ingresso, iid_inv).promoter_id is None
        assert db.get(Ingresso, iid_off).promoter_id is None
        assert db.get(Ingresso, iid_outro).promoter_id is None
        assert db.get(Ingresso, iid_sem).promoter_id is None
    finally:
        db.close()


def test_organizador_b_nao_acessa_promoters_do_evento_de_a():
    """B2: dois orgs — B GET/POST/PATCH promoters do evento de A → 403/404."""
    suf = uuid.uuid4().hex[:8]
    tok_a = _registrar("organizador", f"xa{suf}")
    tok_b = _registrar("organizador", f"xb{suf}")
    email_a = f"organizador.prom.xa{suf}@test.com"
    ev = _criar_evento_api(tok_a, email_a, nome="Só do A")
    headers_a = {"Authorization": f"Bearer {tok_a}"}
    headers_b = {"Authorization": f"Bearer {tok_b}"}

    cr = client.post(
        f"/api/eventos/id/{ev['id']}/promoters",
        headers=headers_a,
        json={"codigo": "soA1", "rotulo": "Parceiro A"},
    )
    assert cr.status_code == 200, cr.text
    pid = cr.json()["id"]

    g = client.get(f"/api/eventos/id/{ev['id']}/promoters", headers=headers_b)
    assert g.status_code in (403, 404), g.text

    p = client.post(
        f"/api/eventos/id/{ev['id']}/promoters",
        headers=headers_b,
        json={"codigo": "hackB", "rotulo": "x"},
    )
    assert p.status_code in (403, 404), p.text

    patch = client.patch(
        f"/api/eventos/id/{ev['id']}/promoters/{pid}",
        headers=headers_b,
        json={"ativo": False},
    )
    assert patch.status_code in (403, 404), patch.text

    # A continua conseguindo listar
    ok = client.get(f"/api/eventos/id/{ev['id']}/promoters", headers=headers_a)
    assert ok.status_code == 200
    assert len(ok.json()["promoters"]) == 1


def test_promoter_ref_localstorage_ttl_e_limpeza_pos_pagamento():
    """B4: localStorage + TTL 24h + limparRefPromoter após criar pagamento."""
    assert "localStorage" in PROMOTER_REF_TS
    assert "sessionStorage" not in PROMOTER_REF_TS
    assert "24 * 60 * 60 * 1000" in PROMOTER_REF_TS or "86400000" in PROMOTER_REF_TS
    assert "exp" in PROMOTER_REF_TS
    assert "export function limparRefPromoter" in PROMOTER_REF_TS
    assert "limparRefPromoter" in COMPRAR_TSX
    assert "limparRefPromoter(eventoId)" in COMPRAR_TSX


def test_compartilhar_publico_remove_param_ref():
    """B3: default sem shareUrl remove ?ref=; painel continua com shareUrl explícito."""
    assert "urlCompartilharSemRef" in COMPARTILHAR_TSX
    assert 'searchParams.delete("ref")' in COMPARTILHAR_TSX
    assert "urlCompartilharSemRef(window.location.href)" in COMPARTILHAR_TSX
    painel = Path("frontend/src/components/evento-promoters-painel.tsx").read_text(encoding="utf-8")
    assert "shareUrl={shareUrl}" in painel
    assert "?ref=" in painel
