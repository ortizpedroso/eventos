"""Bootstrap: telefone de contato e admin da plataforma."""

from __future__ import annotations

import uuid

from app.models import Usuario
from app.models.platform_settings import PlatformSettings
from app.services.auth import hash_password
from app.services.bootstrap_platform_admin import ensure_platform_owner_admin
from app.services.bootstrap_platform_contact import ensure_platform_contact_from_env
from app.services.platform_settings import get_public_settings
from config.settings import settings
from tests.test_api import TestingSessionLocal


def test_concede_admin_ao_email_user(monkeypatch):
    email = f"dono_{uuid.uuid4().hex[:8]}@eventosbr.app.br"
    monkeypatch.setattr(settings, "EMAIL_USER", email)
    monkeypatch.setattr(settings, "PLATFORM_OWNER_EMAIL", "")
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


def test_concede_admin_ao_platform_owner_email(monkeypatch):
    owner = f"owner_{uuid.uuid4().hex[:8]}@eventosbr.app.br"
    monkeypatch.setattr(settings, "PLATFORM_OWNER_EMAIL", owner)
    monkeypatch.setattr(settings, "EMAIL_USER", "outro@eventosbr.app.br")
    db = TestingSessionLocal()
    try:
        db.add(
            Usuario(
                email=owner,
                nome="Owner",
                senha_hash=hash_password("senha-forte-123"),
                tipo="organizador",
                is_platform_admin=False,
            )
        )
        db.commit()

        ensure_platform_owner_admin(db)
        usuario = db.query(Usuario).filter(Usuario.email == owner).one()
        assert usuario.is_platform_admin is True
    finally:
        db.close()


def test_fallback_admin_unico_organizador(monkeypatch):
    monkeypatch.setattr(settings, "PLATFORM_OWNER_EMAIL", "")
    monkeypatch.setattr(settings, "EMAIL_USER", "inexistente@eventosbr.app.br")
    monkeypatch.delenv("NEXT_PUBLIC_EMAIL_CONTATO", raising=False)
    db = TestingSessionLocal()
    try:
        db.query(Usuario).filter(Usuario.is_platform_admin.is_(True)).update(
            {Usuario.is_platform_admin: False},
            synchronize_session=False,
        )
        db.commit()

        email = f"org_{uuid.uuid4().hex[:8]}@eventosbr.app.br"
        db.add(
            Usuario(
                email=email,
                nome="Único org",
                senha_hash=hash_password("senha-forte-123"),
                tipo="organizador",
                is_platform_admin=False,
            )
        )
        db.commit()

        ensure_platform_owner_admin(db)
        admins = db.query(Usuario).filter(Usuario.is_platform_admin.is_(True)).all()
        assert len(admins) == 1
        assert admins[0].tipo == "organizador"
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


def test_bootstrap_contact_phone_from_env(monkeypatch):
    monkeypatch.setenv("TELEFONE_CONTATO", "11987654321")
    db = TestingSessionLocal()
    try:
        row = db.get(PlatformSettings, "default")
        if row:
            row.contact_phone = None
            row.social_whatsapp_url = None
            db.commit()

        ensure_platform_contact_from_env(db)
        pub = get_public_settings(db)
        assert pub.contact_phone == "11987654321"
        assert pub.social_whatsapp_url == "https://wa.me/5511987654321"
    finally:
        db.close()


def test_discover_contact_from_telefone_do_dono(monkeypatch):
    monkeypatch.delenv("TELEFONE_CONTATO", raising=False)
    monkeypatch.delenv("NEXT_PUBLIC_TELEFONE_CONTATO", raising=False)
    monkeypatch.setattr(settings, "TELEFONE_CONTATO", "")
    email = f"dono_tel_{uuid.uuid4().hex[:8]}@eventosbr.app.br"
    monkeypatch.setattr(settings, "EMAIL_USER", email)
    db = TestingSessionLocal()
    try:
        row = db.get(PlatformSettings, "default")
        if row:
            row.contact_phone = None
            row.social_whatsapp_url = None
            db.commit()

        db.add(
            Usuario(
                email=email,
                nome="Dono",
                senha_hash=hash_password("senha-forte-123"),
                tipo="organizador",
                telefone="11988776655",
            )
        )
        db.commit()

        ensure_platform_contact_from_env(db)
        pub = get_public_settings(db)
        assert pub.contact_phone == "11988776655"
        assert pub.social_whatsapp_url == "https://wa.me/5511988776655"
    finally:
        db.close()
