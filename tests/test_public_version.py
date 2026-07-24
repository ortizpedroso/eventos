"""Versão pública da API (deploy)."""

from __future__ import annotations

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_public_version():
    r = client.get("/api/public/version")
    assert r.status_code == 200
    data = r.json()
    assert "git_commit" in data
    assert data["features"]["asset_upload"] is True
    assert data["features"]["email_branding"] is True
