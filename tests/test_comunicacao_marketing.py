"""Opt-in de comunicações de marketing (email / WhatsApp)."""

from __future__ import annotations

import uuid

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.models import Usuario, get_db
from config.database import Base
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


def test_registro_com_optin_email():
    email = f"opt_{uuid.uuid4().hex[:8]}@test.com"
    r = client.post(
        "/api/auth/registrar",
        json={
            "email": email,
            "nome": "Opt In",
            "senha": "senha12345",
            "tipo": "cliente",
            "aceita_comunicacao_email": True,
            "aceita_comunicacao_whatsapp": False,
        },
    )
    assert r.status_code == 200, r.text
    data = r.json()["usuario"]
    assert data["aceita_comunicacao_email"] is True
    assert data["aceita_comunicacao_whatsapp"] is False
    assert data["comunicacao_consentimento_em"] is not None


def test_whatsapp_exige_telefone():
    r = client.post(
        "/api/auth/registrar",
        json={
            "email": f"wpp_{uuid.uuid4().hex[:8]}@test.com",
            "nome": "Sem Tel",
            "senha": "senha12345",
            "tipo": "cliente",
            "aceita_comunicacao_whatsapp": True,
        },
    )
    assert r.status_code == 400
    assert "WhatsApp" in r.json()["detail"]


def test_atualizar_preferencias_perfil():
    email = f"pf_{uuid.uuid4().hex[:8]}@test.com"
    reg = client.post(
        "/api/auth/registrar",
        json={
            "email": email,
            "nome": "Perfil",
            "senha": "senha12345",
            "tipo": "cliente",
        },
    )
    token = reg.json()["access_token"]
    h = {"Authorization": f"Bearer {token}"}

    patch = client.patch(
        "/api/auth/me",
        headers=h,
        json={
            "nome": "Perfil",
            "email": email,
            "aceita_comunicacao_whatsapp": True,
            "telefone": "11987654321",
        },
    )
    assert patch.status_code == 200, patch.text
    body = patch.json()
    assert body["aceita_comunicacao_whatsapp"] is True
    assert body["telefone"] == "11987654321"


def test_export_admin_requer_chave(monkeypatch):
    from config.settings import settings

    monkeypatch.setattr(settings, "PLATFORM_ADMIN_API_KEY", "chave-teste-secreta")
    sem = client.get("/api/admin/marketing/contatos")
    assert sem.status_code == 401

    com = client.get(
        "/api/admin/marketing/contatos?canal=email",
        headers={"X-Platform-Admin-Key": "chave-teste-secreta"},
    )
    assert com.status_code == 200, com.text
    assert "total" in com.json()


def test_export_admin_csv(monkeypatch):
    from config.settings import settings

    monkeypatch.setattr(settings, "PLATFORM_ADMIN_API_KEY", "csv-key")
    email = f"csv_{uuid.uuid4().hex[:8]}@test.com"
    client.post(
        "/api/auth/registrar",
        json={
            "email": email,
            "nome": "CSV User",
            "senha": "senha12345",
            "tipo": "cliente",
            "aceita_comunicacao_email": True,
        },
    )
    r = client.get(
        "/api/admin/marketing/contatos?canal=email&formato=csv",
        headers={"X-Platform-Admin-Key": "csv-key"},
    )
    assert r.status_code == 200
    assert "text/csv" in r.headers.get("content-type", "")
    assert email in r.text


def test_criar_e_disparar_campanha(monkeypatch):
    from config.settings import settings

    monkeypatch.setattr(settings, "PLATFORM_ADMIN_API_KEY", "camp-key")
    email = f"camp_{uuid.uuid4().hex[:8]}@test.com"
    client.post(
        "/api/auth/registrar",
        json={
            "email": email,
            "nome": "Camp User",
            "senha": "senha12345",
            "tipo": "cliente",
            "aceita_comunicacao_email": True,
        },
    )
    h = {"X-Platform-Admin-Key": "camp-key"}
    r = client.post(
        "/api/admin/marketing/campanhas",
        headers=h,
        json={
            "nome": "Teste campanha",
            "assunto": "Olá EventosBR",
            "mensagem": "Mensagem de teste para opt-in.",
            "canal": "email",
            "busca": "Camp",
            "filtro_canal": "email",
            "disparar_agora": False,
        },
    )
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["total_destinatarios"] >= 1
    assert data["status"] == "rascunho"
