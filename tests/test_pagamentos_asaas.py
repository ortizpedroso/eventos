"""Fluxo de pagamento e webhook Asaas."""

from __future__ import annotations

import json
import uuid
from unittest.mock import MagicMock, patch

from fastapi.testclient import TestClient

from app.main import app
from config.database import Base
from app.models import Evento, Usuario, get_db
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

WALLET_ORG = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"
WALLET_PLATFORM = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"


def _asaas_env_patch():
    """Context manager patches para simular Asaas ativo."""
    from contextlib import contextmanager

    @contextmanager
    def _cm():
        with (
            patch("app.routes.pagamentos.settings") as route_settings,
            patch("app.routes.organizador.settings") as org_settings,
        ):
            route_settings.payments_disabled = False
            route_settings.use_asaas = True
            route_settings.ASAAS_PLATFORM_WALLET_ID = WALLET_PLATFORM
            org_settings.payments_disabled = False
            org_settings.use_asaas = True
            yield

    return _cm()


def _configurar_wallet_org(org_token: str) -> None:
    with (
        patch("app.routes.organizador.settings") as org_settings,
        patch("app.services.organizador_asaas.settings") as svc_settings,
    ):
        org_settings.payments_disabled = False
        org_settings.use_asaas = True
        svc_settings.use_asaas = True
        svc_settings.payments_disabled = False
        r = client.put(
            "/api/organizador/asaas/wallet",
            headers={"Authorization": f"Bearer {org_token}"},
            json={"wallet_id": WALLET_ORG},
        )
    assert r.status_code == 200, r.text


def _registrar_organizador(suffix: str, *, com_wallet: bool = True) -> str:
    r = client.post(
        "/api/auth/registrar",
        json={
            "email": f"org_pay_{suffix}@test.com",
            "nome": "Org Pay",
            "senha": "senha12345",
            "tipo": "organizador",
        },
    )
    assert r.status_code == 200
    token = r.json()["access_token"]
    if com_wallet:
        _configurar_wallet_org(token)
    return token


def _registrar_cliente(suffix: str) -> str:
    r = client.post(
        "/api/auth/registrar",
        json={
            "email": f"cli_pay_{suffix}@test.com",
            "nome": "Cliente",
            "senha": "senha12345",
            "tipo": "cliente",
        },
    )
    assert r.status_code == 200
    return r.json()["access_token"]


def _criar_evento(org_token: str) -> dict:
    r = client.post(
        "/api/eventos/criar",
        headers={"Authorization": f"Bearer {org_token}"},
        json={
            "nome": f"Evento {uuid.uuid4().hex[:6]}",
            "descricao": "Teste",
            "data_inicio": "2026-12-01T10:00:00",
            "data_fim": "2026-12-01T22:00:00",
            "local": "SP",
            "preco_ingresso": 50,
            "categoria": "Outros",
            "ingresso_lotes": [{"nome": "Geral", "preco": 50, "ordem": 1, "ativo": True}],
        },
    )
    assert r.status_code == 200, r.text
    return r.json()


class TestPagamentosAsaas:
    def test_criar_reserva_asaas(self):
        org = _registrar_organizador("res")
        cli = _registrar_cliente("res")
        ev = _criar_evento(org)

        with patch("app.routes.pagamentos.settings") as route_settings:
            route_settings.payments_disabled = False
            route_settings.use_asaas = True
            route_settings.ASAAS_PLATFORM_WALLET_ID = WALLET_PLATFORM
            r = client.post(
                "/api/pagamentos/criar",
                headers={"Authorization": f"Bearer {cli}"},
                json={
                    "evento_id": ev["id"],
                    "valor_centavos": 5000,
                    "participante_nome": "Comprador",
                    "participante_email": "comprador@test.com",
                    "participante_cpf": "52998224725",
                    "participante_telefone": "11987654321",
                    "termo_compra_aceito": True,
                },
            )
        assert r.status_code == 200, r.text
        body = r.json()
        assert body.get("payment_provider") == "asaas"
        assert body.get("aguardando_cobranca") is True
        assert body.get("ingresso_id")

    def test_criar_sem_wallet_falha(self):
        org = _registrar_organizador("nowal", com_wallet=False)
        cli = _registrar_cliente("nowal")
        ev = _criar_evento(org)
        with patch("app.routes.pagamentos.settings") as route_settings:
            route_settings.payments_disabled = False
            route_settings.use_asaas = True
            route_settings.ASAAS_PLATFORM_WALLET_ID = WALLET_PLATFORM
            r = client.post(
                "/api/pagamentos/criar",
                headers={"Authorization": f"Bearer {cli}"},
                json={
                    "evento_id": ev["id"],
                    "valor_centavos": 5000,
                    "termo_compra_aceito": True,
                },
            )
        assert r.status_code == 400
        assert "repasse" in r.json()["detail"].lower()

    def test_webhook_asaas_marca_pago(self):
        org = _registrar_organizador("wh")
        cli = _registrar_cliente("wh")
        ev = _criar_evento(org)

        with patch("app.routes.pagamentos.settings") as route_settings:
            route_settings.payments_disabled = False
            route_settings.use_asaas = True
            route_settings.ASAAS_PLATFORM_WALLET_ID = WALLET_PLATFORM
            r = client.post(
                "/api/pagamentos/criar",
                headers={"Authorization": f"Bearer {cli}"},
                json={
                    "evento_id": ev["id"],
                    "valor_centavos": 5000,
                    "participante_nome": "WH",
                    "participante_email": "wh@test.com",
                    "participante_cpf": "52998224725",
                    "participante_telefone": "11987654321",
                    "termo_compra_aceito": True,
                },
            )
        assert r.status_code == 200
        iid = r.json()["ingresso_id"]
        pay_id = f"pay_{uuid.uuid4().hex[:12]}"
        mock_payment = {
            "id": pay_id,
            "status": "PENDING",
            "billingType": "PIX",
            "pixTransaction": {"encodedImage": "abc", "payload": "00020126"},
        }
        with (
            patch("app.routes.pagamentos.settings") as route_settings,
            patch("app.services.pagamentos_asaas_handlers.settings") as svc_settings,
            patch("app.services.pagamentos_asaas_handlers.garantir_customer_asaas", return_value="cus_x"),
            patch("app.services.pagamentos_asaas_handlers.criar_cobranca_asaas", return_value=mock_payment),
        ):
            route_settings.use_asaas = True
            svc_settings.ASAAS_PLATFORM_WALLET_ID = WALLET_PLATFORM
            cob = client.post(
                "/api/pagamentos/asaas/cobranca",
                headers={"Authorization": f"Bearer {cli}"},
                json={"ingresso_id": iid, "metodo": "pix"},
            )
        assert cob.status_code == 200, cob.text

        with patch("app.routes.webhooks.settings") as wh_settings:
            wh_settings.ASAAS_WEBHOOK_TOKEN = "tok_test"
            wh_settings.ENVIRONMENT = "test"
            payload = {
                "id": f"evt_{uuid.uuid4().hex[:8]}",
                "event": "PAYMENT_RECEIVED",
                "payment": {"id": pay_id, "status": "RECEIVED"},
            }
            wh = client.post(
                "/api/webhooks/asaas",
                headers={"asaas-access-token": "tok_test", "content-type": "application/json"},
                content=json.dumps(payload),
            )
        assert wh.status_code == 200

        with patch("app.routes.pagamentos.settings") as route_settings:
            route_settings.use_asaas = True
            st = client.get(
                f"/api/pagamentos/asaas/status/{iid}",
                headers={"Authorization": f"Bearer {cli}"},
            )
        assert st.status_code == 200
        assert st.json().get("pago") is True

    def test_cobranca_pix_mock(self):
        org = _registrar_organizador("pix")
        cli = _registrar_cliente("pix")
        ev = _criar_evento(org)

        with patch("app.routes.pagamentos.settings") as route_settings:
            route_settings.payments_disabled = False
            route_settings.use_asaas = True
            route_settings.ASAAS_PLATFORM_WALLET_ID = WALLET_PLATFORM
            criar = client.post(
                "/api/pagamentos/criar",
                headers={"Authorization": f"Bearer {cli}"},
                json={
                    "evento_id": ev["id"],
                    "valor_centavos": 5000,
                    "participante_nome": "Pix",
                    "participante_email": "pix@test.com",
                    "participante_cpf": "52998224725",
                    "participante_telefone": "11987654321",
                    "termo_compra_aceito": True,
                },
            )
        iid = criar.json()["ingresso_id"]
        mock_payment = {
            "id": "pay_pix_test",
            "status": "PENDING",
            "billingType": "PIX",
            "pixTransaction": {"encodedImage": "abc", "payload": "00020126"},
        }
        with (
            patch("app.routes.pagamentos.settings") as route_settings,
            patch("app.services.pagamentos_asaas_handlers.settings") as svc_settings,
            patch("app.services.pagamentos_asaas_handlers.garantir_customer_asaas", return_value="cus_x"),
            patch("app.services.pagamentos_asaas_handlers.criar_cobranca_asaas", return_value=mock_payment),
        ):
            route_settings.use_asaas = True
            svc_settings.ASAAS_PLATFORM_WALLET_ID = WALLET_PLATFORM
            cob = client.post(
                "/api/pagamentos/asaas/cobranca",
                headers={"Authorization": f"Bearer {cli}"},
                json={"ingresso_id": iid, "metodo": "pix"},
            )
        assert cob.status_code == 200, cob.text
        assert cob.json().get("pix")


def test_webhook_asaas_rejeita_sem_token_producao():
    with patch("app.routes.webhooks.settings") as s:
        s.ASAAS_WEBHOOK_TOKEN = ""
        s.ENVIRONMENT = "production"
        s.ASAAS_E2E_MOCK = False
        r = client.post(
            "/api/webhooks/asaas",
            content="{}",
            headers={"content-type": "application/json"},
        )
    assert r.status_code == 503


def test_split_asaas_taxa_por_ingresso():
    from app.services.pagamento_asaas import split_para_evento
    from app.services.tarifas_plataforma import taxa_ingresso

    ev = Evento(asaas_wallet_id="wallet-org", nome="E")
    with patch("app.services.pagamento_asaas.settings") as s:
        s.ASAAS_PLATFORM_WALLET_ID = "wallet-platform"
        splits = split_para_evento(ev, 100.0, quantidade=2)
    taxa_esperada = round(2 * taxa_ingresso(50.0), 2)
    liquido_esperado = round(100.0 - taxa_esperada, 2)
    by_wallet = {x["walletId"]: x["fixedValue"] for x in splits}
    assert by_wallet["wallet-platform"] == taxa_esperada
    assert by_wallet["wallet-org"] == liquido_esperado
