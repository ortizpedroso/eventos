"""Fluxo de pagamento e webhook Asaas."""

from __future__ import annotations

import json
import uuid
from unittest.mock import MagicMock, patch

from fastapi.testclient import TestClient

from app.main import app
from config.database import Base
from app.models import Evento, Ingresso, Usuario, get_db
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


def test_reembolso_parcial_asaas_multi_ingresso():
    from app.models import Ingresso
    from app.services.pagamentos_asaas_handlers import cancelar_com_reembolso_asaas

    db = TestingSessionLocal()
    try:
        org = _registrar_organizador("partial")
        ev = _criar_evento(org)
        ing1 = Ingresso(
            evento_id=ev["id"],
            usuario_id="u1",
            valor=50.0,
            status="pago",
            asaas_payment_id="pay_multi",
        )
        ing2 = Ingresso(
            evento_id=ev["id"],
            usuario_id="u1",
            valor=50.0,
            status="pago",
            asaas_payment_id="pay_multi",
        )
        db.add(ing1)
        db.add(ing2)
        db.commit()
        db.refresh(ing1)
        with patch("app.services.pagamentos_asaas_handlers.reembolsar_cobranca") as mock_refund:
            mock_refund.return_value = {"id": "ref_partial"}
            ref = cancelar_com_reembolso_asaas(db, ing1)
        mock_refund.assert_called_once_with("pay_multi", valor=50.0)
        assert ref == "ref_partial"
    finally:
        db.close()


def test_webhook_asaas_refund_cancela_pago():
    from tests import test_api as ta

    db = ta.TestingSessionLocal()
    try:
        org = _registrar_organizador("refund")
        ev = _criar_evento(org)
        ing = Ingresso(
            evento_id=ev["id"],
            usuario_id="user-refund",
            valor=50.0,
            status="pago",
            asaas_payment_id="pay_refund_wh",
        )
        db.add(ing)
        db.commit()
        iid = ing.id
    finally:
        db.close()

    with patch("app.routes.webhooks.settings") as wh_settings:
        wh_settings.ASAAS_WEBHOOK_TOKEN = "tok_test"
        wh_settings.ENVIRONMENT = "test"
        payload = {
            "id": f"evt_{uuid.uuid4().hex[:8]}",
            "event": "PAYMENT_REFUNDED",
            "payment": {"id": "pay_refund_wh", "status": "REFUNDED"},
        }
        wh = client.post(
            "/api/webhooks/asaas",
            headers={"asaas-access-token": "tok_test", "content-type": "application/json"},
            content=json.dumps(payload),
        )
    assert wh.status_code == 200
    db = ta.TestingSessionLocal()
    try:
        ing = db.get(Ingresso, iid)
        assert ing is not None
        assert ing.status == "cancelado"
    finally:
        db.close()


def test_webhook_asaas_reembolsa_quando_ingresso_nao_liberado():
    from tests import test_api as ta

    db = ta.TestingSessionLocal()
    try:
        org = _registrar_organizador("wh422")
        ev = _criar_evento(org)
        ev_db = db.query(Evento).filter(Evento.id == ev["id"]).first()
        ev_db.lista_espera_habilitada = True
        from app.services.lista_espera import inscrever_espera

        entrada = inscrever_espera(db, ev_db, email="fila@ex.com")
        entrada.status = "notificado"
        entrada.token_compra = f"tok-{uuid.uuid4().hex[:8]}"
        from datetime import datetime, timedelta, timezone

        entrada.token_expira_em = datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(hours=24)
        ing = Ingresso(
            evento_id=ev["id"],
            usuario_id="user-wh422",
            participante_email="outro@ex.com",
            valor=50.0,
            status="pendente",
            asaas_payment_id="pay_wh422",
        )
        db.add(ing)
        db.commit()
    finally:
        db.close()

    with (
        patch("app.routes.webhooks.settings") as wh_settings,
        patch("app.services.pagamento_asaas.obter_cobranca") as mock_obter,
        patch("app.services.pagamento_asaas.reembolsar_cobranca") as mock_reembolso,
    ):
        wh_settings.ASAAS_WEBHOOK_TOKEN = "tok_test"
        wh_settings.ENVIRONMENT = "test"
        mock_obter.return_value = {"id": "pay_wh422", "status": "CONFIRMED"}
        payload = {
            "id": f"evt_{uuid.uuid4().hex[:8]}",
            "event": "PAYMENT_CONFIRMED",
            "payment": {"id": "pay_wh422", "status": "CONFIRMED"},
        }
        wh = client.post(
            "/api/webhooks/asaas",
            headers={"asaas-access-token": "tok_test", "content-type": "application/json"},
            content=json.dumps(payload),
        )
    assert wh.status_code == 200
    mock_reembolso.assert_called_once_with("pay_wh422")

    db = ta.TestingSessionLocal()
    try:
        ing = db.query(Ingresso).filter(Ingresso.asaas_payment_id == "pay_wh422").first()
        assert ing is not None
        assert ing.status == "cancelado"
    finally:
        db.close()


def test_cobranca_card_remote_ip_do_servidor():
    org = _registrar_organizador("rip")
    cli = _registrar_cliente("rip")
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
                "participante_nome": "Rip",
                "participante_email": "rip@test.com",
                "participante_cpf": "52998224725",
                "participante_telefone": "11987654321",
                "termo_compra_aceito": True,
            },
        )
    assert criar.status_code == 200, criar.text
    iid = criar.json()["ingresso_id"]

    captured: dict = {}

    def _fake_criar(**kwargs):
        captured.update(kwargs)
        return {"id": "pay_rip", "status": "PENDING", "billingType": "CREDIT_CARD"}

    with (
        patch("app.routes.pagamentos.settings") as route_settings,
        patch("app.services.pagamentos_asaas_handlers.settings") as svc_settings,
        patch("app.deps.rate_limit.client_ip_from_request", return_value="10.0.0.1"),
        patch("app.services.pagamentos_asaas_handlers.garantir_customer_asaas", return_value="cus_x"),
        patch("app.services.pagamentos_asaas_handlers.criar_cobranca_asaas", side_effect=_fake_criar),
    ):
        route_settings.use_asaas = True
        svc_settings.ASAAS_PLATFORM_WALLET_ID = WALLET_PLATFORM
        cob = client.post(
            "/api/pagamentos/asaas/cobranca",
            headers={"Authorization": f"Bearer {cli}", "X-Forwarded-For": "10.0.0.1"},
            json={
                "ingresso_id": iid,
                "metodo": "card",
                "remote_ip": "8.8.8.8",
                "credit_card": {
                    "holderName": "Rip",
                    "number": "4111111111111111",
                    "expiryMonth": "12",
                    "expiryYear": "2030",
                    "ccv": "123",
                },
                "credit_card_holder_info": {
                    "name": "Rip",
                    "email": "rip@test.com",
                    "cpfCnpj": "52998224725",
                    "postalCode": "01310100",
                    "addressNumber": "1",
                },
            },
        )
    assert cob.status_code == 200, cob.text
    assert captured.get("remote_ip") == "10.0.0.1"


def test_iniciar_cobranca_nao_recria_se_obter_cobranca_falha():
    import pytest
    from datetime import datetime, timedelta, timezone
    from fastapi import HTTPException

    from app.services.asaas_client import AsaasAPIError
    from app.services.pagamentos_asaas_handlers import AsaasCobrancaRequest, iniciar_cobranca_asaas
    from tests import test_patamar_ux as tpu

    db = tpu._db()
    try:
        org = tpu._criar_org(db)
        ev = tpu._criar_evento(db, org.id)
        ev.asaas_wallet_id = WALLET_ORG
        ev.lista_espera_habilitada = False
        db.commit()
        ing = Ingresso(
            evento_id=ev.id,
            usuario_id=org.id,
            participante_email="buyer@ex.com",
            valor=50.0,
            status="pendente",
            asaas_payment_id="pay_obter_fail",
            reservado_ate=datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(minutes=30),
        )
        db.add(ing)
        db.commit()
        db.refresh(ing)
        iid = ing.id
    finally:
        db.close()

    with (
        patch("app.services.pagamentos_asaas_handlers.settings") as s,
        patch(
            "app.services.pagamentos_asaas_handlers.obter_cobranca",
            side_effect=AsaasAPIError("timeout", status_code=503),
        ),
        patch("app.services.pagamentos_asaas_handlers.criar_cobranca_asaas") as criar_mock,
    ):
        s.ASAAS_PLATFORM_WALLET_ID = WALLET_PLATFORM
        db = tpu._db()
        try:
            ing = db.get(Ingresso, iid)
            org = db.get(Usuario, ing.usuario_id)
            with pytest.raises(HTTPException) as exc:
                iniciar_cobranca_asaas(db, org, AsaasCobrancaRequest(ingresso_id=ing.id, metodo="pix"))
            assert exc.value.status_code == 503
            criar_mock.assert_not_called()
            db.refresh(ing)
            assert ing.asaas_payment_id == "pay_obter_fail"
        finally:
            db.close()


def test_status_cobranca_pago_false_sem_403_quando_espera_bloqueia():
    from datetime import datetime, timedelta, timezone

    from app.models import EventoListaEspera
    from app.services.pagamentos_asaas_handlers import status_cobranca_asaas
    from tests import test_patamar_ux as tpu

    db = tpu._db()
    try:
        org = tpu._criar_org(db)
        ev = tpu._criar_evento(db, org.id)
        entrada = EventoListaEspera(
            evento_id=ev.id,
            email="fila@ex.com",
            posicao=1,
            status="notificado",
            token_compra=f"tok-{uuid.uuid4().hex[:8]}",
            token_expira_em=datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(hours=24),
        )
        db.add(entrada)
        ing = Ingresso(
            evento_id=ev.id,
            usuario_id=org.id,
            participante_email="outro@ex.com",
            valor=50.0,
            status="pendente",
            asaas_payment_id="pay_poll_espera",
        )
        db.add(ing)
        db.commit()
        iid = ing.id
    finally:
        db.close()

    with patch(
        "app.services.pagamentos_asaas_handlers.obter_cobranca",
        return_value={"status": "CONFIRMED", "id": "pay_poll_espera"},
    ):
        db = tpu._db()
        try:
            ing = db.get(Ingresso, iid)
            org = db.get(Usuario, ing.usuario_id)
            out = status_cobranca_asaas(db, iid, org)
            assert out["pago"] is False
            assert out["status"] == "CONFIRMED"
            db.refresh(ing)
            assert ing.status == "pendente"
        finally:
            db.close()


def test_split_cap_nao_excede_valor():
    from app.services.pagamento_asaas import split_para_evento

    ev = Evento(asaas_wallet_id="wallet-org", nome="Barato")
    with patch("app.services.pagamento_asaas.settings") as s:
        s.ASAAS_PLATFORM_WALLET_ID = "wallet-platform"
        splits = split_para_evento(ev, 1.0, quantidade=1)
    total = sum(x["fixedValue"] for x in splits)
    assert total <= 1.0
