"""Bootstrap: proprietário (EMAIL_USER) recebe is_platform_admin."""

from __future__ import annotations

import uuid

from app.models import Usuario
from app.services.auth import hash_password
from app.services.bootstrap_platform_admin import ensure_platform_owner_admin
from config.settings import settings
from tests.test_api import TestingSessionLocal


def test_concede_admin_ao_email_user(monkeypatch):
    email = f"dono_{uuid.uuid4().hex[:8]}@eventosbr.app.br"
    monkeypatch.setattr(settings, "EMAIL_USER", email)
    db = TestingSessionLocal()
    try:
        db.add(
            Usuario(
                email=email,
                nome="Dono",
                senha_hash=hash_password("senha-forte-123"),
                tipo="organizador",
                is_platform_admin=False,
            )
        )
        db.commit()

        ensure_platform_owner_admin(db)
        usuario = db.query(Usuario).filter(Usuario.email == email).one()
        assert usuario.is_platform_admin is True
    finally:
        db.close()


def test_nao_revoga_admin_existente(monkeypatch):
    email = f"admin_{uuid.uuid4().hex[:8]}@eventosbr.app.br"
    monkeypatch.setattr(settings, "EMAIL_USER", email)
    db = TestingSessionLocal()
    try:
        db.add(
            Usuario(
                email=email,
                nome="Admin",
                senha_hash=hash_password("senha-forte-123"),
                tipo="organizador",
                is_platform_admin=True,
            )
        )
        db.commit()

        ensure_platform_owner_admin(db)
        usuario = db.query(Usuario).filter(Usuario.email == email).one()
        assert usuario.is_platform_admin is True
    finally:
        db.close()
