"""Onboarding Asaas do organizador."""

from __future__ import annotations

import uuid
from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from app.main import app
from config.database import Base
from app.models import get_db
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


def _registrar_organizador(suffix: str) -> str:
    r = client.post(
        "/api/auth/registrar",
        json={
            "email": f"org_asaas_{suffix}@test.com",
            "nome": "Org Asaas",
            "senha": "senha12345",
            "tipo": "organizador",
        },
    )
    assert r.status_code == 200
    return r.json()["access_token"]


class TestOrganizadorAsaas:
    def test_status_sem_wallet(self):
        token = _registrar_organizador("st")
        with patch("app.services.organizador_asaas.settings") as mock_settings:
            mock_settings.use_asaas = True
            mock_settings.payments_disabled = False
            r = client.get(
                "/api/organizador/asaas",
                headers={"Authorization": f"Bearer {token}"},
            )
        assert r.status_code == 200
        body = r.json()
        assert body["wallet_configurado"] is False
        assert body["repasses_prontos"] is False

    def test_definir_wallet_rejeita_wallet_plataforma(self):
        from app.services.organizador_asaas import validar_wallet_repasse
        from config.settings import settings

        old = settings.ASAAS_PLATFORM_WALLET_ID
        settings.ASAAS_PLATFORM_WALLET_ID = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"
        try:
            with pytest.raises(ValueError, match="plataforma"):
                validar_wallet_repasse("aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee")
        finally:
            settings.ASAAS_PLATFORM_WALLET_ID = old

    def test_consultar_wallet_rejeita_conta_plataforma(self):
        from app.services.organizador_asaas import consultar_wallet_organizador_por_api_key
        from config.settings import settings

        platform_wallet = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"
        old = settings.ASAAS_PLATFORM_WALLET_ID
        settings.ASAAS_PLATFORM_WALLET_ID = platform_wallet
        try:
            with patch("app.services.organizador_asaas.AsaasClient") as mock_client_cls:
                mock_client = MagicMock()
                mock_client.enabled = True
                mock_client.get.return_value = {"walletId": platform_wallet, "name": "Plataforma"}
                mock_client_cls.return_value = mock_client
                with pytest.raises(ValueError, match="plataforma"):
                    consultar_wallet_organizador_por_api_key("org_api_key_test")
        finally:
            settings.ASAAS_PLATFORM_WALLET_ID = old

    def test_consultar_wallet_via_api_key(self):
        token = _registrar_organizador("wal_cons")
        wallet = str(uuid.uuid4())
        with (
            patch("app.routes.organizador.settings") as route_settings,
            patch("app.services.organizador_asaas.AsaasClient") as mock_client_cls,
        ):
            route_settings.payments_disabled = False
            route_settings.use_asaas = True
            route_settings.permite_vinculo_wallet_organizador.return_value = True
            route_settings.asaas_allow_manual_wallet = False
            mock_client = MagicMock()
            mock_client.enabled = True
            mock_client.get.return_value = {"walletId": wallet, "name": "Org Teste"}
            mock_client_cls.return_value = mock_client
            r = client.post(
                "/api/organizador/asaas/wallet/consultar",
                headers={"Authorization": f"Bearer {token}"},
                json={"api_key": "org_api_key_test"},
            )
        assert r.status_code == 200, r.text
        assert r.json()["wallet_id"] == wallet

    def test_definir_wallet_valida_api_key(self):
        token = _registrar_organizador("wal_api")
        wallet = str(uuid.uuid4())
        with (
            patch("app.routes.organizador.settings") as route_settings,
            patch("app.services.organizador_asaas.settings") as mock_settings,
            patch("app.services.organizador_asaas.AsaasClient") as mock_client_cls,
        ):
            route_settings.payments_disabled = False
            route_settings.use_asaas = True
            route_settings.permite_vinculo_wallet_organizador.return_value = True
            route_settings.asaas_allow_manual_wallet = False
            mock_settings.use_asaas = True
            mock_settings.permite_vinculo_wallet_organizador.return_value = True
            mock_settings.asaas_allow_manual_wallet = False
            mock_settings.permite_subconta_baas.return_value = True
            mock_settings.ASAAS_PLATFORM_WALLET_ID = "wallet-platform-other"
            mock_client = MagicMock()
            mock_client.enabled = True
            mock_client.get.return_value = {"walletId": wallet}
            mock_client_cls.return_value = mock_client
            r = client.put(
                "/api/organizador/asaas/wallet",
                headers={"Authorization": f"Bearer {token}"},
                json={"wallet_id": wallet, "api_key": "org_api_key_test"},
            )
        assert r.status_code == 200, r.text
        assert r.json().get("verificado_api") is True

    def test_definir_wallet(self):
        token = _registrar_organizador("wal")
        wallet = str(uuid.uuid4())
        with (
            patch("app.routes.organizador.settings") as route_settings,
            patch("app.services.organizador_asaas.settings") as mock_settings,
        ):
            route_settings.payments_disabled = False
            route_settings.use_asaas = True
            route_settings.permite_vinculo_wallet_organizador.return_value = True
            route_settings.asaas_allow_manual_wallet = False
            mock_settings.use_asaas = True
            mock_settings.payments_disabled = False
            mock_settings.permite_vinculo_wallet_organizador.return_value = True
            mock_settings.asaas_allow_manual_wallet = False
            mock_settings.permite_subconta_baas.return_value = True
            r = client.put(
                "/api/organizador/asaas/wallet",
                headers={"Authorization": f"Bearer {token}"},
                json={"wallet_id": wallet},
            )
        assert r.status_code == 200, r.text
        assert r.json()["wallet_id"] == wallet

        st = client.get(
            "/api/organizador/asaas",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert st.status_code == 200
        assert st.json()["wallet_id"] == wallet

    def test_simular_antecipacao_estimativa(self):
        token = _registrar_organizador("sim")
        with patch("app.services.organizador_asaas.settings") as mock_settings:
            mock_settings.use_asaas = True
            r = client.post(
                "/api/organizador/asaas/antecipacao/simular",
                headers={"Authorization": f"Bearer {token}"},
                json={"valor_reais": 100.0},
            )
        assert r.status_code == 200
        body = r.json()
        assert body["modo"] == "estimativa"
        assert body["valor_bruto"] == 100.0
        assert "liquido_antecipado_estimado" in body

    def test_antecipacao_sem_subconta_falha(self):
        token = _registrar_organizador("ant")
        r = client.put(
            "/api/organizador/asaas/antecipacao",
            headers={"Authorization": f"Bearer {token}"},
            json={"credit_card_automatic_enabled": True},
        )
        assert r.status_code == 400
        assert "subconta" in r.json()["detail"].lower()

    def test_criar_subconta_exige_data_nascimento_cpf(self):
        token = _registrar_organizador("sub_birth")
        with (
            patch("app.routes.organizador.settings") as route_settings,
            patch("app.services.organizador_asaas.settings") as mock_settings,
        ):
            route_settings.payments_disabled = False
            route_settings.use_asaas = True
            mock_settings.use_asaas = True
            mock_settings.permite_subconta_baas.return_value = True
            r = client.post(
                "/api/organizador/asaas/subconta",
                headers={"Authorization": f"Bearer {token}"},
                json={
                    "cpf_cnpj": "52998224725",
                    "telefone": "11987654321",
                    "renda_mensal": 8000,
                    "cep": "89010025",
                    "endereco": "Rua Teste",
                    "numero": "100",
                    "bairro": "Centro",
                },
            )
        assert r.status_code == 400
        assert "nascimento" in r.json()["detail"].lower()

    def test_criar_subconta_mock(self):
        token = _registrar_organizador("sub")
        wallet = str(uuid.uuid4())
        mock_resp = {"id": "acc_test", "walletId": wallet, "apiKey": "sub_key_test"}
        with (
            patch("app.routes.organizador.settings") as route_settings,
            patch("app.services.organizador_asaas.settings") as mock_settings,
            patch("app.services.organizador_asaas.get_asaas_client") as mock_client_factory,
        ):
            route_settings.payments_disabled = False
            route_settings.use_asaas = True
            mock_settings.use_asaas = True
            mock_settings.permite_subconta_baas.return_value = True
            mock_settings.payments_disabled = False
            mock_client = MagicMock()
            mock_client.post.return_value = mock_resp
            mock_client_factory.return_value = mock_client
            r = client.post(
                "/api/organizador/asaas/subconta",
                headers={"Authorization": f"Bearer {token}"},
                json={
                    "cpf_cnpj": "52998224725",
                    "telefone": "11987654321",
                    "renda_mensal": 8000,
                    "cep": "89010025",
                    "endereco": "Rua Teste",
                    "numero": "100",
                    "bairro": "Centro",
                    "data_nascimento": "1990-05-15",
                },
            )
        assert r.status_code == 200, r.text
        assert r.json()["wallet_id"] == wallet
        posted = mock_client.post.call_args.kwargs.get("json") or mock_client.post.call_args[1].get("json")
        assert posted.get("birthDate") == "1990-05-15"

        st = client.get(
            "/api/organizador/asaas",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert st.status_code == 200
        assert st.json()["tem_subconta"] is True
        assert st.json()["wallet_id"] == wallet

    def test_subconta_api_key_criptografada_no_banco(self):
        from app.models import Usuario
        from app.services.organizador_asaas import criar_subconta_organizador
        from app.utils.secret_storage import decrypt_at_rest, is_encrypted_at_rest

        db = TestingSessionLocal()
        try:
            usuario = Usuario(
                id=str(uuid.uuid4()),
                email=f"enc_{uuid.uuid4().hex[:8]}@test.com",
                nome="Org Enc",
                senha_hash="x",
                tipo="organizador",
            )
            db.add(usuario)
            db.commit()

            wallet = str(uuid.uuid4())
            mock_resp = {"id": "acc_enc", "walletId": wallet, "apiKey": "sub_key_secret"}
            with (
                patch("app.services.organizador_asaas.settings") as mock_settings,
                patch("app.services.organizador_asaas.get_asaas_client") as mock_client_factory,
            ):
                mock_settings.use_asaas = True
                mock_settings.permite_subconta_baas.return_value = True
                mock_client = MagicMock()
                mock_client.post.return_value = mock_resp
                mock_client_factory.return_value = mock_client
                criar_subconta_organizador(
                    db,
                    usuario,
                    cpf_cnpj="52998224725",
                    telefone="11987654321",
                    renda_mensal=8000,
                    cep="89010025",
                    endereco="Rua Teste",
                    numero="100",
                    bairro="Centro",
                    data_nascimento="1990-05-15",
                )

            db.refresh(usuario)
            assert is_encrypted_at_rest(usuario.asaas_subaccount_api_key)
            assert decrypt_at_rest(usuario.asaas_subaccount_api_key) == "sub_key_secret"
            assert usuario.asaas_subaccount_api_key != "sub_key_secret"
        finally:
            db.close()
