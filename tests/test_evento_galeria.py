"""Galeria de edições anteriores — só fotos reais, max 6."""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest

from app.models import Evento, Usuario
from app.services.evento_galeria import GALERIA_MAX, listar_urls, substituir_galeria
from tests import test_api
from tests.test_api import client

NOVO_EVENTO = Path("frontend/src/app/eventos/novo/novo-evento-client.tsx").read_text(encoding="utf-8")
EVENTO_GALERIA = Path("frontend/src/components/evento-galeria.tsx").read_text(encoding="utf-8")


def test_galeria_max_e_substituicao():
    db = test_api.TestingSessionLocal()
    try:
        suf = uuid.uuid4().hex[:8]
        org = Usuario(email=f"org.gal.{suf}@test.com", nome="Org", senha_hash="x", tipo="organizador")
        db.add(org)
        db.commit()
        db.refresh(org)
        agora = datetime.now(timezone.utc).replace(tzinfo=None)
        ev = Evento(
            nome="Gal Evento",
            descricao="d",
            data_inicio=agora + timedelta(days=3),
            data_fim=agora + timedelta(days=3, hours=2),
            local="Sala",
            cidade="BH",
            categoria="Outros",
            preco_ingresso=20.0,
            organizador_id=org.id,
            slug=f"gal-evento-{suf}",
            publicado=True,
        )
        db.add(ev)
        db.commit()
        db.refresh(ev)

        assert listar_urls(db, ev.id) == []
        urls = [f"/uploads/eventos/test/foto{i}.webp" for i in range(GALERIA_MAX)]
        out = substituir_galeria(db, ev, urls)
        assert len(out) == GALERIA_MAX
        assert listar_urls(db, ev.id) == urls

        with pytest.raises(ValueError, match="Máximo"):
            substituir_galeria(db, ev, urls + ["/uploads/eventos/test/extra.webp"])

        # limpar
        assert substituir_galeria(db, ev, []) == []
        assert listar_urls(db, ev.id) == []
    finally:
        db.close()


def test_montar_evento_response_inclui_galeria():
    from app.schemas.evento import montar_evento_response

    db = test_api.TestingSessionLocal()
    try:
        suf = uuid.uuid4().hex[:8]
        org = Usuario(email=f"org.gal2.{suf}@test.com", nome="Org", senha_hash="x", tipo="organizador")
        db.add(org)
        db.commit()
        db.refresh(org)
        agora = datetime.now(timezone.utc).replace(tzinfo=None)
        ev = Evento(
            nome="Gal2",
            descricao="d",
            data_inicio=agora + timedelta(days=3),
            data_fim=agora + timedelta(days=3, hours=2),
            local="Sala",
            cidade="BH",
            categoria="Outros",
            preco_ingresso=20.0,
            organizador_id=org.id,
            slug=f"gal2-evento-{suf}",
            publicado=True,
        )
        db.add(ev)
        db.commit()
        db.refresh(ev)
        substituir_galeria(db, ev, ["/uploads/eventos/test/a.webp"])
        resp = montar_evento_response(db, ev)
        assert resp.galeria_urls == ["/uploads/eventos/test/a.webp"]
    finally:
        db.close()


def test_novo_evento_client_tem_bloco_galeria_0_a_6():
    """C1: criação reutiliza o mesmo bloco de galeria (0–6) do editar."""
    assert "galeria_urls" in NOVO_EVENTO
    assert "galeriaUrls" in NOVO_EVENTO
    assert "Galeria — edições anteriores" in NOVO_EVENTO
    assert "Adicionar foto" in NOVO_EVENTO
    assert "slice(0, 6)" in NOVO_EVENTO


def test_resposta_publica_omite_secao_com_zero_fotos_e_mostra_com_fotos():
    """C2: 0 fotos → galeria vazia (seção pública omitida); ≥1 → URLs presentes."""
    assert "Edições anteriores" in EVENTO_GALERIA
    assert "if (fotos.length === 0) return null" in EVENTO_GALERIA

    suf = uuid.uuid4().hex[:8]
    org = client.post(
        "/api/auth/registrar",
        json={
            "email": f"org.gal.pub.{suf}@test.com",
            "senha": "senha12345",
            "nome": "Org Gal Pub",
            "tipo": "organizador",
        },
    )
    assert org.status_code in (200, 201), org.text
    headers = {"Authorization": f"Bearer {org.json()['access_token']}"}
    agora = datetime.now(timezone.utc).replace(tzinfo=None)
    er = client.post(
        "/api/eventos/criar",
        headers=headers,
        json={
            "nome": "Gal Pública",
            "descricao": "desc",
            "data_inicio": (agora + timedelta(days=4)).isoformat(),
            "local": "Sala",
            "cidade": "BH",
            "contato_telefone": "31999998888",
            "contato_email": f"org.gal.pub.{suf}@test.com",
            "preco_ingresso": 25.0,
            "categoria": "Outros",
            "publicado": True,
            "galeria_urls": [],
        },
    )
    assert er.status_code == 200, er.text
    slug = er.json()["slug"]
    eid = er.json()["id"]

    pub0 = client.get(f"/api/eventos/{slug}")
    assert pub0.status_code == 200, pub0.text
    assert pub0.json().get("galeria_urls") in ([], None) or pub0.json().get("galeria_urls") == []

    pr = client.patch(
        f"/api/eventos/id/{eid}",
        headers=headers,
        json={
            "nome": "Gal Pública",
            "descricao": "desc",
            "data_inicio": (agora + timedelta(days=4)).isoformat(),
            "local": "Sala",
            "cidade": "BH",
            "contato_telefone": "31999998888",
            "contato_email": f"org.gal.pub.{suf}@test.com",
            "preco_ingresso": 25.0,
            "categoria": "Outros",
            "publicado": True,
            "galeria_urls": ["/uploads/eventos/test/edicao.webp"],
        },
    )
    assert pr.status_code == 200, pr.text
    pub1 = client.get(f"/api/eventos/{slug}")
    assert pub1.status_code == 200, pub1.text
    assert pub1.json().get("galeria_urls") == ["/uploads/eventos/test/edicao.webp"]


def test_organizador_b_nao_patch_galeria_do_evento_de_a():
    """C3: org B PATCH galeria_urls do evento de A → 403/404."""
    suf = uuid.uuid4().hex[:8]
    ra = client.post(
        "/api/auth/registrar",
        json={
            "email": f"org.gal.a.{suf}@test.com",
            "senha": "senha12345",
            "nome": "Org A",
            "tipo": "organizador",
        },
    )
    assert ra.status_code in (200, 201), ra.text
    headers_a = {"Authorization": f"Bearer {ra.json()['access_token']}"}
    rb = client.post(
        "/api/auth/registrar",
        json={
            "email": f"org.gal.b.{suf}@test.com",
            "senha": "senha12345",
            "nome": "Org B",
            "tipo": "organizador",
        },
    )
    assert rb.status_code in (200, 201), rb.text
    headers_b = {"Authorization": f"Bearer {rb.json()['access_token']}"}

    agora = datetime.now(timezone.utc).replace(tzinfo=None)
    er = client.post(
        "/api/eventos/criar",
        headers=headers_a,
        json={
            "nome": "Evento Só A",
            "descricao": "desc",
            "data_inicio": (agora + timedelta(days=5)).isoformat(),
            "local": "Hall",
            "cidade": "SP",
            "contato_telefone": "11988887777",
            "contato_email": f"org.gal.a.{suf}@test.com",
            "preco_ingresso": 30.0,
            "categoria": "Outros",
            "publicado": False,
        },
    )
    assert er.status_code == 200, er.text
    eid = er.json()["id"]

    bad = client.patch(
        f"/api/eventos/id/{eid}",
        headers=headers_b,
        json={
            "nome": "Evento Só A",
            "descricao": "desc",
            "data_inicio": (agora + timedelta(days=5)).isoformat(),
            "local": "Hall",
            "cidade": "SP",
            "contato_telefone": "11988887777",
            "contato_email": f"org.gal.a.{suf}@test.com",
            "preco_ingresso": 30.0,
            "categoria": "Outros",
            "publicado": False,
            "galeria_urls": ["/uploads/eventos/test/invasao.webp"],
        },
    )
    assert bad.status_code in (403, 404), bad.text

    ok = client.patch(
        f"/api/eventos/id/{eid}",
        headers=headers_a,
        json={
            "nome": "Evento Só A",
            "descricao": "desc",
            "data_inicio": (agora + timedelta(days=5)).isoformat(),
            "local": "Hall",
            "cidade": "SP",
            "contato_telefone": "11988887777",
            "contato_email": f"org.gal.a.{suf}@test.com",
            "preco_ingresso": 30.0,
            "categoria": "Outros",
            "publicado": False,
            "galeria_urls": ["/uploads/eventos/test/ok.webp"],
        },
    )
    assert ok.status_code == 200, ok.text
    assert ok.json().get("galeria_urls") == ["/uploads/eventos/test/ok.webp"]
