"""Tracker de onboarding conta e assinatura."""

from __future__ import annotations

import json
from unittest.mock import patch

import pytest

from app.models import Usuario
from app.services.onboarding_tracker import (
    _motivos_reprovacao_conta,
    _status_conta_tracker,
    status_onboarding_conta,
    tracking_id_conta,
)


def test_status_conta_tracker_mapeamento():
    assert _status_conta_tracker("pending") == "SUBMITTED"
    assert _status_conta_tracker("awaiting_approval") == "IN_REVIEW"
    assert _status_conta_tracker("approved") == "APPROVED"
    assert _status_conta_tracker("rejected") == "REJECTED"


def test_motivos_reprovacao_conta():
    motivos = _motivos_reprovacao_conta(
        {"documentation": "Documento ilegível", "general": "REJECTED"}
    )
    assert any("Documento" in m for m in motivos)


def test_tracking_id_conta():
    u = Usuario(id="u1", email="a@b.com", nome="A", senha_hash="x", tipo="organizador")
    assert tracking_id_conta(u) == "org-u1"
    u.asaas_account_id = "acc_123"
    assert tracking_id_conta(u) == "acc_123"


def test_status_onboarding_conta_aprovado():
    from sqlalchemy.orm import sessionmaker
    from sqlalchemy import create_engine
    from sqlalchemy.pool import StaticPool
    from config.database import Base

    engine = create_engine(
        "sqlite+pysqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine)
    db = Session()
    usuario = Usuario(
        id="org1",
        email="org@test.com",
        nome="Org",
        senha_hash="x",
        tipo="organizador",
        asaas_account_id="acc1",
        asaas_repasse_status="approved",
        asaas_repasse_detalhes=json.dumps({"general": "APPROVED"}),
    )
    db.add(usuario)
    db.commit()

    with patch("app.services.onboarding_tracker.atualizar_status_repasse_organizador") as mock_upd:
        mock_upd.side_effect = lambda _db, u: u
        payload = status_onboarding_conta(db, usuario, tracking_id="acc1")

    assert payload["status"] == "APPROVED"
    assert payload["final"] is True
    assert payload["titulo_final"] == "Conta criada com sucesso"
