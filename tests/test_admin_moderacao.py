"""Admin: checklist de produção e moderação de eventos."""

from __future__ import annotations

import uuid

from fastapi.testclient import TestClient

from app.main import app
from app.models import get_db
from config.database import Base
from config.settings import settings
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

SQLALCHEMY_DATABASE_URL = "sqlite+pysqlite:///:memory:"
engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base.metadata.create_all(bind=engine)


def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db
client = TestClient(app)

ADMIN_HEADERS = {"X-Platform-Admin-Key": "chave-admin-teste"}


def _registrar_organizador() -> str:
    suf = uuid.uuid4().hex[:8]
    r = client.post(
        "/api/auth/registrar",
        json={
            "email": f"org_adm_{suf}@test.com",
            "nome": "Org Admin",
            "senha": "senha12345",
            "tipo": "organizador",
        },
    )
    assert r.status_code == 200
    return r.json()["access_token"]


def _criar_evento(org_token: str, publicado: bool = True) -> dict:
    r = client.post(
        "/api/eventos/criar",
        headers={"Authorization": f"Bearer {org_token}"},
        json={
            "nome": f"Show {uuid.uuid4().hex[:6]}",
            "descricao": "Moderação",
            "data_inicio": "2026-12-01T10:00:00",
            "data_fim": "2026-12-01T22:00:00",
            "local": "SP",
            "preco_ingresso": 30,
            "categoria": "Outros",
            "publicado": publicado,
            "ingresso_lotes": [{"nome": "Geral", "preco": 30, "ordem": 1, "ativo": True}],
        },
    )
    assert r.status_code == 200, r.text
    return r.json()


def test_setup_requer_chave_admin(monkeypatch):
    monkeypatch.setattr(settings, "PLATFORM_ADMIN_API_KEY", "chave-admin-teste")
    sem = client.get("/api/admin/setup")
    assert sem.status_code == 401
    com = client.get("/api/admin/setup", headers=ADMIN_HEADERS)
    assert com.status_code == 200
    assert "checks" in com.json()


def test_moderar_publicacao_evento(monkeypatch):
    monkeypatch.setattr(settings, "PLATFORM_ADMIN_API_KEY", "chave-admin-teste")
    org = _registrar_organizador()
    ev = _criar_evento(org, publicado=True)

    hide = client.patch(
        f"/api/admin/eventos/{ev['id']}/publicado",
        headers=ADMIN_HEADERS,
        json={"publicado": False},
    )
    assert hide.status_code == 200
    assert hide.json()["publicado"] is False

    lista = client.get("/api/admin/eventos?publicado=false", headers=ADMIN_HEADERS)
    assert lista.status_code == 200
    ids = {e["id"] for e in lista.json()["eventos"]}
    assert ev["id"] in ids


def test_desativar_usuario_impede_login(monkeypatch):
    monkeypatch.setattr(settings, "PLATFORM_ADMIN_API_KEY", "chave-admin-teste")
    email = f"bloq_{uuid.uuid4().hex[:8]}@test.com"
    r = client.post(
        "/api/auth/registrar",
        json={"email": email, "nome": "Bloq", "senha": "senha12345", "tipo": "cliente"},
    )
    assert r.status_code == 200
    uid = r.json()["usuario"]["id"]

    off = client.patch(
        f"/api/admin/usuarios/{uid}/ativo",
        headers=ADMIN_HEADERS,
        json={"ativo": False},
    )
    assert off.status_code == 200

    login = client.post("/api/auth/login", json={"email": email, "senha": "senha12345"})
    assert login.status_code == 403
