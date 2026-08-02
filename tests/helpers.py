"""Helpers compartilhados nos testes."""

from __future__ import annotations

from fastapi.testclient import TestClient


def login_organizador_verificado(client: TestClient, email: str, senha: str = "senha-forte-123") -> str:
    r = client.post("/api/auth/login", json={"email": email, "senha": senha})
    assert r.status_code == 200, r.text
    return r.json()["access_token"]
