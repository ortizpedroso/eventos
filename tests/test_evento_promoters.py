"""Promoters / links ?ref= — atribuição sem comissão."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

from app.models import Evento, Ingresso, Usuario
from app.services.evento_promoters import (
    criar_promoter,
    listar_promoters_com_metricas,
    resolver_promoter_ativo,
)
from tests import test_api
from tests.test_api import client


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
    r = client.post(
        "/api/auth/registrar",
        json={
            "email": "org.api.prom@test.com",
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
            "contato_email": "org.api.prom@test.com",
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
