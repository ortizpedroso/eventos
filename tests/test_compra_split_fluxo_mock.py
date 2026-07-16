"""Fluxo completo compra + split (Asaas E2E mock) — organizador ≠ plataforma."""

from __future__ import annotations

import json
import uuid
from unittest.mock import patch

from fastapi.testclient import TestClient

from app.main import app
from app.models import Evento, Usuario, get_db
from app.services.asaas_e2e_mock import mock_payment_create_payload, mock_reset
from app.services.pagamento_asaas import split_para_evento
from app.services.tarifas_plataforma import taxa_ingresso
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

WALLET_ORG = "aaaa1111-eeee-2222-cccc-333344445566"
WALLET_PLATFORM = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"


def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db
client = TestClient(app)


def _patch_asaas_mock():
    return patch.multiple(
        settings,
        ENVIRONMENT="test",
        ASAAS_E2E_MOCK=True,
        ASAAS_DISABLED=False,
        ASAAS_API_KEY="e2e-mock-key",
        ASAAS_PLATFORM_WALLET_ID=WALLET_PLATFORM,
        ASAAS_WEBHOOK_TOKEN="e2e-webhook-token",
        PAYMENT_PROVIDER="asaas",
        SECRET_KEY="test-secret-key-minimum-32-characters-long",
    )


def _registrar(tipo: str, suffix: str) -> str:
    r = client.post(
        "/api/auth/registrar",
        json={
            "email": f"{tipo}_split_{suffix}@test.com",
            "nome": f"User {tipo}",
            "senha": "senha12345",
            "tipo": tipo,
        },
    )
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


def test_fluxo_compra_split_organizador_distinto_plataforma():
    """Cria evento, compra PIX mock, valida split só no wallet do organizador e ingresso pago."""
    mock_reset()
    suf = uuid.uuid4().hex[:8]

    with _patch_asaas_mock():
        org = _registrar("organizador", suf)
        cli = _registrar("cliente", suf)

        w = client.put(
            "/api/organizador/asaas/wallet",
            headers={"Authorization": f"Bearer {org}"},
            json={"wallet_id": WALLET_ORG, "sincronizar_eventos": True},
        )
        assert w.status_code == 200, w.text

        ev = client.post(
            "/api/eventos/criar",
            headers={"Authorization": f"Bearer {org}"},
            json={
                "nome": f"Split E2E {suf}",
                "descricao": "Teste split",
                "data_inicio": "2026-12-01T10:00:00",
                "data_fim": "2026-12-01T22:00:00",
                "local": "SP",
                "preco_ingresso": 50,
                "categoria": "Outros",
                "publicado": True,
                "ingresso_lotes": [{"nome": "Geral", "preco": 50, "ordem": 1, "ativo": True}],
            },
        )
        assert ev.status_code == 200, ev.text
        evento_id = ev.json()["id"]

        gen = app.dependency_overrides[get_db]()
        db = next(gen)
        try:
            evento = db.query(Evento).filter(Evento.id == evento_id).first()
            assert evento is not None, f"evento {evento_id} não encontrado"
            assert evento.asaas_wallet_id == WALLET_ORG
            org_user = db.query(Usuario).filter(Usuario.email == f"organizador_split_{suf}@test.com").first()
            assert org_user is not None
            assert (org_user.asaas_wallet_id or "").lower() == WALLET_ORG.lower()
            assert (org_user.asaas_wallet_id or "").lower() != WALLET_PLATFORM.lower()
        finally:
            try:
                next(gen)
            except StopIteration:
                pass

        criar = client.post(
            "/api/pagamentos/criar",
            headers={"Authorization": f"Bearer {cli}"},
            json={
                "evento_id": evento_id,
                "valor_centavos": 5000,
                "participante_nome": "Comprador",
                "participante_email": f"cli_split_{suf}@test.com",
                "participante_cpf": "52998224725",
                "participante_telefone": "11987654321",
                "termo_compra_aceito": True,
            },
        )
        assert criar.status_code == 200, criar.text
        ingresso_id = criar.json()["ingresso_id"]

        cob = client.post(
            "/api/pagamentos/asaas/cobranca",
            headers={"Authorization": f"Bearer {cli}"},
            json={"ingresso_id": ingresso_id, "metodo": "pix"},
        )
        assert cob.status_code == 200, cob.text
        pay_id = cob.json().get("payment_id")
        assert pay_id

        payload = mock_payment_create_payload(pay_id)
        assert payload is not None
        splits = payload.get("split") or []
        assert len(splits) == 1
        assert splits[0]["walletId"] == WALLET_ORG
        assert splits[0]["walletId"] != WALLET_PLATFORM
        taxa = round(taxa_ingresso(50.0), 2)
        liquido = round(50.0 - taxa, 2)
        assert splits[0]["fixedValue"] == liquido
        assert WALLET_PLATFORM not in {s["walletId"] for s in splits}

        wh = client.post(
            "/api/webhooks/asaas",
            headers={"asaas-access-token": "e2e-webhook-token", "content-type": "application/json"},
            content=json.dumps(
                {
                    "id": f"evt_{suf}",
                    "event": "PAYMENT_RECEIVED",
                    "payment": {"id": pay_id, "status": "RECEIVED", "externalReference": ingresso_id},
                }
            ),
        )
        assert wh.status_code == 200, wh.text

        st = client.get(
            f"/api/pagamentos/asaas/status/{ingresso_id}",
            headers={"Authorization": f"Bearer {cli}"},
        )
        assert st.status_code == 200
        assert st.json().get("pago") is True

        meus = client.get(
            "/api/pagamentos/meus?status=pago",
            headers={"Authorization": f"Bearer {cli}"},
        )
        assert meus.status_code == 200
        ids = {row["id"] for row in meus.json()}
        assert ingresso_id in ids


def test_split_para_evento_nao_inclui_wallet_plataforma():
    ev = Evento(asaas_wallet_id=WALLET_ORG, nome="E")
    with patch.object(settings, "ASAAS_PLATFORM_WALLET_ID", WALLET_PLATFORM):
        splits = split_para_evento(ev, 50.0)
    assert len(splits) == 1
    assert splits[0]["walletId"] == WALLET_ORG
    assert splits[0]["walletId"] != WALLET_PLATFORM
