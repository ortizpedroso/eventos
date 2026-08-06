"""Publicar/pausar evento com imagem legada."""

from __future__ import annotations

import uuid

from config.settings import settings
from tests import test_api

client = test_api.client


def _registrar_org() -> str:
    email = f"org_pub_{uuid.uuid4().hex[:8]}@test.com"
    r = client.post(
        "/api/auth/registrar",
        json={"email": email, "nome": "Org Pub", "senha": "senha-forte-123", "tipo": "organizador"},
    )
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


def _payload_evento(**overrides):
    base = {
        "nome": f"Evento {uuid.uuid4().hex[:6]}",
        "descricao": "Teste",
        "data_inicio": "2026-12-01T10:00:00",
        "data_fim": "2026-12-01T22:00:00",
        "local": "SP",
        "preco_ingresso": 0,
        "categoria": "Outros",
        "contato_telefone": "11987654321",
        "contato_email": "contato@teste.com",
        "publicado": True,
        "ingresso_lotes": [{"nome": "Cortesia", "tipo": "cortesia", "preco": 0, "ordem": 1, "ativo": True}],
    }
    base.update(overrides)
    return base


def test_criar_evento_rejeita_imagem_externa(monkeypatch):
    monkeypatch.setattr(settings, "FRONTEND_PUBLIC_URL", "https://eventosbr.app.br")
    monkeypatch.setattr(settings, "R2_PUBLIC_URL", "")
    monkeypatch.setattr(settings, "UPLOAD_PUBLIC_BASE_URL", "https://eventosbr.app.br")

    token = _registrar_org()
    r = client.post(
        "/api/eventos/criar",
        json=_payload_evento(imagem_url="https://images.unsplash.com/photo-test.jpg"),
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r.status_code == 422


def test_pausar_evento_com_imagem_externa_legada(monkeypatch):
    monkeypatch.setattr(settings, "FRONTEND_PUBLIC_URL", "https://eventosbr.app.br")

    token = _registrar_org()
    headers = {"Authorization": f"Bearer {token}"}
    externa = "https://cdn.exemplo.com/banner-antigo.jpg"

    criar_ok = client.post("/api/eventos/criar", json=_payload_evento(), headers=headers)
    assert criar_ok.status_code == 200, criar_ok.text
    ev_id = criar_ok.json()["id"]

    from app.models import Evento

    db = test_api.TestingSessionLocal()
    try:
        ev = db.get(Evento, ev_id)
        assert ev is not None
        ev.imagem_url = externa
        db.commit()
    finally:
        db.close()

    pausar = client.patch(
        f"/api/eventos/id/{ev_id}/publicado",
        json={"publicado": False},
        headers=headers,
    )
    assert pausar.status_code == 200, pausar.text
    assert pausar.json()["publicado"] is False
    assert pausar.json()["imagem_url"] == externa


def test_atualizar_imagem_externa_inalterada_ok(monkeypatch):
    monkeypatch.setattr(settings, "FRONTEND_PUBLIC_URL", "https://eventosbr.app.br")

    token = _registrar_org()
    headers = {"Authorization": f"Bearer {token}"}
    criar_ok = client.post("/api/eventos/criar", json=_payload_evento(), headers=headers)
    assert criar_ok.status_code == 200
    ev_id = criar_ok.json()["id"]
    externa = "https://cdn.exemplo.com/banner-antigo.jpg"

    from app.models import Evento

    db = test_api.TestingSessionLocal()
    try:
        ev = db.get(Evento, ev_id)
        assert ev is not None
        ev.imagem_url = externa
        nome = ev.nome
        db.commit()
    finally:
        db.close()

    patch_r = client.patch(
        f"/api/eventos/id/{ev_id}",
        json={
            "nome": nome,
            "descricao": "Teste",
            "data_inicio": "2026-12-01T10:00:00",
            "data_fim": "2026-12-01T22:00:00",
            "local": "SP",
            "imagem_url": externa,
            "preco_ingresso": 0,
            "categoria": "Outros",
            "contato_telefone": "11987654321",
            "contato_email": "contato@teste.com",
            "publicado": True,
        },
        headers=headers,
    )
    assert patch_r.status_code == 200, patch_r.text


def test_trocar_imagem_externa_bloqueada(monkeypatch):
    monkeypatch.setattr(settings, "FRONTEND_PUBLIC_URL", "https://eventosbr.app.br")

    token = _registrar_org()
    headers = {"Authorization": f"Bearer {token}"}
    criar_ok = client.post("/api/eventos/criar", json=_payload_evento(), headers=headers)
    ev_id = criar_ok.json()["id"]
    nome = criar_ok.json()["nome"]

    patch_r = client.patch(
        f"/api/eventos/id/{ev_id}",
        json={
            "nome": nome,
            "descricao": "Teste",
            "data_inicio": "2026-12-01T10:00:00",
            "data_fim": "2026-12-01T22:00:00",
            "local": "SP",
            "imagem_url": "https://evil.example.com/novo.jpg",
            "preco_ingresso": 0,
            "categoria": "Outros",
            "contato_telefone": "11987654321",
            "contato_email": "contato@teste.com",
            "publicado": True,
        },
        headers=headers,
    )
    assert patch_r.status_code == 400, patch_r.text
    assert "externa" in patch_r.json()["detail"].lower()


def test_atualizar_galeria_externa_inalterada_ok(monkeypatch):
    monkeypatch.setattr(settings, "FRONTEND_PUBLIC_URL", "https://eventosbr.app.br")

    token = _registrar_org()
    headers = {"Authorization": f"Bearer {token}"}
    criar_ok = client.post("/api/eventos/criar", json=_payload_evento(), headers=headers)
    assert criar_ok.status_code == 200
    ev_id = criar_ok.json()["id"]
    nome = criar_ok.json()["nome"]
    externa = "https://cdn.exemplo.com/foto-antiga.jpg"

    from app.models import Evento, EventoGaleriaFoto

    db = test_api.TestingSessionLocal()
    try:
        ev = db.get(Evento, ev_id)
        assert ev is not None
        db.add(
            EventoGaleriaFoto(
                evento_id=ev_id,
                url=externa,
                ordem=0,
            )
        )
        db.commit()
    finally:
        db.close()

    patch_r = client.patch(
        f"/api/eventos/id/{ev_id}",
        json={
            "nome": nome,
            "descricao": "Teste",
            "data_inicio": "2026-12-01T10:00:00",
            "data_fim": "2026-12-01T22:00:00",
            "local": "SP",
            "preco_ingresso": 0,
            "categoria": "Outros",
            "contato_telefone": "11987654321",
            "contato_email": "contato@teste.com",
            "publicado": False,
            "galeria_urls": [externa],
        },
        headers=headers,
    )
    assert patch_r.status_code == 200, patch_r.text
    assert patch_r.json()["galeria_urls"] == [externa]
