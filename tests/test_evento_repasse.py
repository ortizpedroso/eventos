"""Repasse Asaas: wallet por evento e compra_disponivel."""

from __future__ import annotations

import uuid
from datetime import datetime
from unittest.mock import patch

from fastapi.testclient import TestClient

from app.main import app
from app.models import Evento, Usuario, get_db
from app.schemas.evento import montar_evento_response
from app.services.evento_repasse import garantir_wallet_repasse_evento, resolver_wallet_repasse_evento
from app.services.ingresso_lotes import criar_lotes_iniciais
from app.services.organizador_asaas import sincronizar_wallet_eventos_organizador
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

_DT_INICIO = datetime(2030, 1, 1, 20, 0, 0)
_DT_FIM = datetime(2030, 1, 1, 23, 0, 0)
_DT_INICIO2 = datetime(2030, 6, 1, 20, 0, 0)
_DT_FIM2 = datetime(2030, 6, 1, 23, 0, 0)


def _db():
    return TestingSessionLocal()


class TestEventoRepasse:
    def test_resolver_wallet_fallback_organizador(self):
        db = _db()
        try:
            u = Usuario(
                id=str(uuid.uuid4()),
                email=f"org-{uuid.uuid4().hex[:8]}@test.com",
                nome="Org Wallet",
                senha_hash="x",
                tipo="organizador",
                asaas_wallet_id="wallet-org-test",
            )
            db.add(u)
            ev = Evento(
                id=str(uuid.uuid4()),
                nome="Show",
                slug=f"show-{uuid.uuid4().hex[:6]}",
                descricao="d",
                data_inicio=_DT_INICIO,
                data_fim=_DT_FIM,
                local="Local",
                preco_ingresso=50.0,
                organizador_id=u.id,
                asaas_wallet_id=None,
                publicado=True,
            )
            db.add(ev)
            db.commit()
            assert resolver_wallet_repasse_evento(db, ev) == "wallet-org-test"
        finally:
            db.close()

    def test_garantir_wallet_persiste_no_evento(self):
        db = _db()
        try:
            u = Usuario(
                id=str(uuid.uuid4()),
                email=f"org2-{uuid.uuid4().hex[:8]}@test.com",
                nome="Org Wallet",
                senha_hash="x",
                tipo="organizador",
                asaas_wallet_id="wallet-org-test",
            )
            db.add(u)
            ev = Evento(
                id=str(uuid.uuid4()),
                nome="Show 2",
                slug=f"show2-{uuid.uuid4().hex[:6]}",
                descricao="d",
                data_inicio=_DT_INICIO,
                data_fim=_DT_FIM,
                local="Local",
                preco_ingresso=50.0,
                organizador_id=u.id,
                asaas_wallet_id=None,
                publicado=True,
            )
            db.add(ev)
            db.flush()
            criar_lotes_iniciais(db, ev, 50.0)
            db.commit()
            db.refresh(ev)

            wid = garantir_wallet_repasse_evento(db, ev)
            db.commit()
            db.refresh(ev)
            assert wid == "wallet-org-test"
            assert ev.asaas_wallet_id == "wallet-org-test"
        finally:
            db.close()

    def test_compra_indisponivel_sem_wallet_organizador(self):
        db = _db()
        try:
            org = Usuario(
                id=str(uuid.uuid4()),
                email=f"sem-{uuid.uuid4().hex[:8]}@test.com",
                nome="Sem Wallet",
                senha_hash="x",
                tipo="organizador",
            )
            db.add(org)
            ev = Evento(
                id=str(uuid.uuid4()),
                nome="Sem repasse",
                slug=f"sem-{uuid.uuid4().hex[:6]}",
                descricao="d",
                data_inicio=_DT_INICIO2,
                data_fim=_DT_FIM2,
                local="Local",
                preco_ingresso=30.0,
                organizador_id=org.id,
                publicado=True,
            )
            db.add(ev)
            db.flush()
            criar_lotes_iniciais(db, ev, 30.0)
            db.commit()
            db.refresh(ev)

            with patch("config.settings.settings") as mock_settings:
                mock_settings.use_asaas = True
                mock_settings.payments_disabled = False
                mock_settings.ASAAS_PLATFORM_WALLET_ID = "wallet-platform"
                body = montar_evento_response(db, ev)
            assert body.compra_disponivel is False
            assert body.motivo_compra_indisponivel
            assert "repasses" in body.motivo_compra_indisponivel.lower()
        finally:
            db.close()

    def test_sincronizar_wallet_eventos_organizador(self):
        db = _db()
        try:
            u = Usuario(
                id=str(uuid.uuid4()),
                email=f"sync-{uuid.uuid4().hex[:8]}@test.com",
                nome="Org Sync",
                senha_hash="x",
                tipo="organizador",
                asaas_wallet_id="wallet-org-test",
            )
            db.add(u)
            ev = Evento(
                id=str(uuid.uuid4()),
                nome="Antigo",
                slug=f"ant-{uuid.uuid4().hex[:6]}",
                descricao="d",
                data_inicio=_DT_INICIO,
                data_fim=_DT_FIM,
                local="Local",
                preco_ingresso=40.0,
                organizador_id=u.id,
                asaas_wallet_id=None,
                publicado=True,
            )
            db.add(ev)
            db.commit()

            n = sincronizar_wallet_eventos_organizador(db, u)
            db.commit()
            db.refresh(ev)
            assert n == 1
            assert ev.asaas_wallet_id == "wallet-org-test"
        finally:
            db.close()

    def test_status_asaas_sincroniza_eventos_sem_wallet(self):
        def override_get_db():
            db = _db()
            try:
                yield db
            finally:
                db.close()

        app.dependency_overrides[get_db] = override_get_db
        client = TestClient(app)
        try:
            reg = client.post(
                "/api/auth/registrar",
                json={
                    "email": f"sync-api-{uuid.uuid4().hex[:8]}@test.com",
                    "nome": "Org API",
                    "senha": "senha12345",
                    "tipo": "organizador",
                },
            )
            assert reg.status_code == 200
            token = reg.json()["access_token"]

            db = _db()
            try:
                org = db.query(Usuario).filter(Usuario.email == reg.json()["usuario"]["email"]).first()
                org.asaas_wallet_id = "wallet-sync-api"
                ev = Evento(
                    id=str(uuid.uuid4()),
                    nome="Evt",
                    slug=f"evt-{uuid.uuid4().hex[:6]}",
                    descricao="d",
                    data_inicio=_DT_INICIO,
                    data_fim=_DT_FIM,
                    local="L",
                    preco_ingresso=20.0,
                    organizador_id=org.id,
                    publicado=True,
                )
                db.add(ev)
                db.commit()
            finally:
                db.close()

            with (
                patch("app.routes.organizador.settings") as route_settings,
                patch("app.services.organizador_asaas.settings") as svc_settings,
            ):
                route_settings.use_asaas = True
                route_settings.payments_disabled = False
                svc_settings.use_asaas = True
                svc_settings.payments_disabled = False
                r = client.get(
                    "/api/organizador/asaas",
                    headers={"Authorization": f"Bearer {token}"},
                )
            assert r.status_code == 200
            assert r.json()["eventos_sem_wallet"] == 0
        finally:
            app.dependency_overrides.pop(get_db, None)
