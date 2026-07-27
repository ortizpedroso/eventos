"""Conversão de conta cliente para organizador."""

from __future__ import annotations

import uuid

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def _registrar(email: str, tipo: str = "cliente") -> dict:
    r = client.post(
        "/api/auth/registrar",
        json={"email": email, "nome": "Teste Conversão", "senha": "senha-forte-123", "tipo": tipo},
    )
    assert r.status_code == 200, r.text
    return r.json()


class TestTornarOrganizador:
    def test_cliente_vira_organizador(self):
        data = _registrar(f"conv1_{uuid.uuid4().hex[:8]}@teste.com", tipo="cliente")
        headers = {"Authorization": f"Bearer {data['access_token']}"}
        r = client.post(
            "/api/auth/tornar-organizador",
            json={"telefone": "(11) 98765-4321"},
            headers=headers,
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["tipo"] == "organizador"
        assert body["telefone"] == "11987654321"

    def test_ja_organizador_recebe_erro(self):
        data = _registrar(f"conv2_{uuid.uuid4().hex[:8]}@teste.com", tipo="organizador")
        headers = {"Authorization": f"Bearer {data['access_token']}"}
        r = client.post(
            "/api/auth/tornar-organizador",
            json={"telefone": "(11) 98765-4321"},
            headers=headers,
        )
        assert r.status_code == 400

    def test_telefone_invalido_rejeitado(self):
        data = _registrar(f"conv3_{uuid.uuid4().hex[:8]}@teste.com", tipo="cliente")
        headers = {"Authorization": f"Bearer {data['access_token']}"}
        r = client.post(
            "/api/auth/tornar-organizador",
            json={"telefone": "123"},
            headers=headers,
        )
        assert r.status_code == 422

    def test_conta_convertida_acessa_rotas_de_organizador(self):
        data = _registrar(f"conv4_{uuid.uuid4().hex[:8]}@teste.com", tipo="cliente")
        headers = {"Authorization": f"Bearer {data['access_token']}"}
        client.post("/api/auth/tornar-organizador", json={"telefone": "11987654321"}, headers=headers)

        r = client.post(
            "/api/eventos/criar",
            json={
                "nome": "Evento pós-conversão",
                "descricao": "Teste",
                "data_inicio": "2026-12-01T10:00:00",
                "data_fim": "2026-12-01T22:00:00",
                "local": "SP",
                "preco_ingresso": 50,
                "categoria": "Outros",
                "contato_telefone": "11987654321",
                "contato_email": "contato@teste.com",
                "publicado": False,
                "ingresso_lotes": [{"nome": "Geral", "preco": 50, "ordem": 1, "ativo": True}],
            },
            headers=headers,
        )
        assert r.status_code == 200, r.text
