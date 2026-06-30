"""Publicação de evento pago exige repasse Asaas aprovado."""

from __future__ import annotations

import uuid
from datetime import datetime
from unittest.mock import patch

import pytest
from fastapi import HTTPException

from app.models import Evento, Usuario
from app.services.evento_repasse import validar_publicacao_evento_pago
from app.services.ingresso_lotes import criar_lotes_iniciais
from config.database import Base
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

engine = create_engine(
    "sqlite+pysqlite:///:memory:",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
Session = sessionmaker(bind=engine)
Base.metadata.create_all(bind=engine)

_DT = datetime(2030, 1, 1, 20, 0, 0)
_DT_FIM = datetime(2030, 1, 1, 23, 0, 0)


def _db():
    return Session()


def test_publicar_pago_sem_repasse_bloqueado():
    db = _db()
    try:
        org = Usuario(
            id=str(uuid.uuid4()),
            email=f"org-{uuid.uuid4().hex[:8]}@t.com",
            nome="Org",
            senha_hash="x",
            tipo="organizador",
        )
        db.add(org)
        ev = Evento(
            id=str(uuid.uuid4()),
            nome="Pago",
            slug=f"p-{uuid.uuid4().hex[:6]}",
            descricao="d",
            data_inicio=_DT,
            data_fim=_DT_FIM,
            local="L",
            preco_ingresso=50.0,
            organizador_id=org.id,
            publicado=False,
        )
        db.add(ev)
        db.flush()
        criar_lotes_iniciais(db, ev, 50.0)
        db.commit()
        db.refresh(ev)

        with (
            patch("app.services.evento_repasse.settings") as s,
        ):
            s.use_asaas = True
            s.payments_disabled = False
            with pytest.raises(HTTPException) as exc:
                validar_publicacao_evento_pago(db, org, ev, publicado=True)
            assert exc.value.status_code == 400
    finally:
        db.close()


def test_publicar_pago_repasse_pendente_bloqueado():
    db = _db()
    try:
        org = Usuario(
            id=str(uuid.uuid4()),
            email=f"org2-{uuid.uuid4().hex[:8]}@t.com",
            nome="Org",
            senha_hash="x",
            tipo="organizador",
            asaas_wallet_id="w1",
            asaas_repasse_status="pending",
        )
        db.add(org)
        ev = Evento(
            id=str(uuid.uuid4()),
            nome="Pago",
            slug=f"p2-{uuid.uuid4().hex[:6]}",
            descricao="d",
            data_inicio=_DT,
            data_fim=_DT_FIM,
            local="L",
            preco_ingresso=50.0,
            organizador_id=org.id,
            publicado=False,
        )
        db.add(ev)
        db.flush()
        criar_lotes_iniciais(db, ev, 50.0)
        db.commit()
        db.refresh(ev)

        with (
            patch("app.services.evento_repasse.settings") as s,
        ):
            s.use_asaas = True
            s.payments_disabled = False
            with pytest.raises(HTTPException) as exc:
                validar_publicacao_evento_pago(db, org, ev, publicado=True)
            assert exc.value.status_code == 400
    finally:
        db.close()


def test_publicar_pago_repasse_aprovado_ok():
    db = _db()
    try:
        org = Usuario(
            id=str(uuid.uuid4()),
            email=f"org3-{uuid.uuid4().hex[:8]}@t.com",
            nome="Org",
            senha_hash="x",
            tipo="organizador",
            asaas_wallet_id="w1",
            asaas_repasse_status="approved",
        )
        db.add(org)
        ev = Evento(
            id=str(uuid.uuid4()),
            nome="Pago",
            slug=f"p3-{uuid.uuid4().hex[:6]}",
            descricao="d",
            data_inicio=_DT,
            data_fim=_DT_FIM,
            local="L",
            preco_ingresso=50.0,
            organizador_id=org.id,
            publicado=False,
        )
        db.add(ev)
        db.flush()
        criar_lotes_iniciais(db, ev, 50.0)
        db.commit()
        db.refresh(ev)

        with patch("app.services.evento_repasse.settings") as s:
            s.use_asaas = True
            s.payments_disabled = False
            validar_publicacao_evento_pago(db, org, ev, publicado=True)
    finally:
        db.close()


def test_evento_gratuito_publica_sem_repasse():
    db = _db()
    try:
        org = Usuario(
            id=str(uuid.uuid4()),
            email=f"org4-{uuid.uuid4().hex[:8]}@t.com",
            nome="Org",
            senha_hash="x",
            tipo="organizador",
        )
        db.add(org)
        ev = Evento(
            id=str(uuid.uuid4()),
            nome="Gratis",
            slug=f"g-{uuid.uuid4().hex[:6]}",
            descricao="d",
            data_inicio=_DT,
            data_fim=_DT_FIM,
            local="L",
            preco_ingresso=0.0,
            organizador_id=org.id,
            publicado=False,
        )
        db.add(ev)
        db.flush()
        criar_lotes_iniciais(db, ev, 0.0)
        db.commit()
        db.refresh(ev)

        with patch("app.services.evento_repasse.settings") as s:
            s.use_asaas = True
            validar_publicacao_evento_pago(db, org, ev, publicado=True)
    finally:
        db.close()
