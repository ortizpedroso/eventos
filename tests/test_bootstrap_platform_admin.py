"""Bootstrap: primeiro admin via EMAIL_USER quando ninguém tem is_platform_admin."""

from __future__ import annotations

import uuid

from app.models import Usuario
from app.services.auth import hash_password
from app.services.bootstrap_platform_admin import ensure_platform_owner_admin
from config.settings import settings
from tests.test_api import TestingSessionLocal


def test_concede_admin_ao_email_user_quando_nenhum_admin(monkeypatch):
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
        assert db.query(Usuario).filter(Usuario.is_platform_admin.is_(True)).count() == 1
    finally:
        db.close()


def test_nao_altera_quando_ja_existe_admin(monkeypatch):
    monkeypatch.setattr(settings, "EMAIL_USER", "outro@eventosbr.app.br")
    db = TestingSessionLocal()
    try:
        db.add(
            Usuario(
                email="admin@eventosbr.app.br",
                nome="Admin",
                senha_hash=hash_password("senha-forte-123"),
                tipo="organizador",
                is_platform_admin=True,
            )
        )
        db.add(
            Usuario(
                email="outro@eventosbr.app.br",
                nome="Outro",
                senha_hash=hash_password("senha-forte-123"),
                tipo="organizador",
                is_platform_admin=False,
            )
        )
        db.commit()

        ensure_platform_owner_admin(db)

        outro = db.query(Usuario).filter(Usuario.email == "outro@eventosbr.app.br").one()
        assert outro.is_platform_admin is False
    finally:
        db.close()
