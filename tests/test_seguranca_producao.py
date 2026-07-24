"""Testes das correções de segurança extraídas da auditoria de produção (07/2026):

- CPF/CNPJ de repasse cifrado em repouso + validação de dígito verificador
- Assinatura HMAC do check-in retrocompatível (12 chars legado + 20 chars novo)
- Deduplicação de webhook Asaas
- Reembolso com valor zero bloqueado
"""

import uuid
from unittest.mock import MagicMock, patch

from fastapi.testclient import TestClient

from app.main import app
from app.models import Usuario, WebhookEvent
from tests.test_api import TestingSessionLocal

client = TestClient(app)


class TestCpfCnpjRepasseCifrado:
    def test_cpf_cnpj_cifrado_e_valido_no_banco(self):
        from app.services.organizador_asaas import criar_subconta_organizador
        from app.utils.secret_storage import decrypt_at_rest, is_encrypted_at_rest

        db = TestingSessionLocal()
        try:
            usuario = Usuario(
                id=str(uuid.uuid4()),
                email=f"cpfenc_{uuid.uuid4().hex[:8]}@test.com",
                nome="Org CPF Enc",
                senha_hash="x",
                tipo="organizador",
            )
            db.add(usuario)
            db.commit()

            wallet = str(uuid.uuid4())
            mock_resp = {"id": "acc_cpf", "walletId": wallet, "apiKey": "key_x"}
            with (
                patch("app.services.organizador_asaas.settings") as mock_settings,
                patch("app.services.organizador_asaas.get_asaas_client") as mock_client_factory,
                patch("app.services.organizador_asaas.assert_plataforma_pode_provisionar_contas"),
            ):
                mock_settings.use_asaas = True
                mock_settings.permite_subconta_baas.return_value = True
                mock_client = MagicMock()
                mock_client.post.return_value = mock_resp
                mock_client_factory.return_value = mock_client
                criar_subconta_organizador(
                    db,
                    usuario,
                    cpf_cnpj="529.982.247-25",
                    telefone="11987654321",
                    renda_mensal=8000,
                    cep="89010025",
                    endereco="Rua Teste",
                    numero="100",
                    bairro="Centro",
                    data_nascimento="1990-05-15",
                )

            db.refresh(usuario)
            assert is_encrypted_at_rest(usuario.asaas_repasse_cpf_cnpj)
            assert decrypt_at_rest(usuario.asaas_repasse_cpf_cnpj) == "52998224725"
            assert usuario.asaas_repasse_cpf_cnpj != "52998224725"
        finally:
            db.close()

    def test_cpf_invalido_rejeitado_na_criacao_subconta(self):
        from app.services.organizador_asaas import criar_subconta_organizador

        db = TestingSessionLocal()
        try:
            usuario = Usuario(
                id=str(uuid.uuid4()),
                email=f"cpfbad_{uuid.uuid4().hex[:8]}@test.com",
                nome="Org CPF Ruim",
                senha_hash="x",
                tipo="organizador",
            )
            db.add(usuario)
            db.commit()

            with (
                patch("app.services.organizador_asaas.settings") as mock_settings,
                patch("app.services.organizador_asaas.assert_plataforma_pode_provisionar_contas"),
            ):
                mock_settings.use_asaas = True
                mock_settings.permite_subconta_baas.return_value = True
                try:
                    criar_subconta_organizador(
                        db,
                        usuario,
                        cpf_cnpj="11111111111",  # dígito verificador inválido
                        telefone="11987654321",
                        renda_mensal=8000,
                        cep="89010025",
                        endereco="Rua Teste",
                        numero="100",
                        bairro="Centro",
                        data_nascimento="1990-05-15",
                    )
                    assert False, "deveria ter levantado ValueError"
                except ValueError as e:
                    assert "inválido" in str(e).lower()
        finally:
            db.close()


class TestHmacCheckinRetrocompativel:
    def test_assinatura_nova_tem_20_chars(self):
        from app.services.ingresso_checkin import assinatura_ingresso

        sig = assinatura_ingresso("ingresso-abc-123")
        assert len(sig) == 20

    def test_codigo_com_assinatura_legada_ainda_valida(self):
        from app.services.ingresso_checkin import (
            _assinatura_legada_ingresso,
            extrair_ingresso_id,
        )

        ingresso_id = "11111111-1111-1111-1111-111111111111"
        sig_legada = _assinatura_legada_ingresso(ingresso_id)
        assert len(sig_legada) == 12
        codigo_antigo = f"EBR1:{ingresso_id}:{sig_legada}"
        assert extrair_ingresso_id(codigo_antigo) == ingresso_id

    def test_codigo_com_assinatura_nova_valida(self):
        from app.services.ingresso_checkin import codigo_checkin, extrair_ingresso_id

        ingresso_id = "22222222-2222-2222-2222-222222222222"
        codigo = codigo_checkin(ingresso_id)
        assert extrair_ingresso_id(codigo) == ingresso_id

    def test_assinatura_forjada_rejeitada(self):
        from app.services.ingresso_checkin import extrair_ingresso_id

        ingresso_id = "33333333-3333-3333-3333-333333333333"
        assert extrair_ingresso_id(f"EBR1:{ingresso_id}:000000000000") is None


class TestWebhookDedup:
    def test_evento_duplicado_nao_reprocessa(self):
        db = TestingSessionLocal()
        try:
            existente = WebhookEvent(id="evt_dedup_test_1", tipo="PAYMENT_RECEIVED")
            db.add(existente)
            db.commit()
        finally:
            db.close()

        payload = {
            "id": "evt_dedup_test_1",
            "event": "PAYMENT_RECEIVED",
            "payment": {"id": "pay_dedup_1"},
        }
        with patch("app.routes.webhooks.settings") as mock_settings:
            mock_settings.ASAAS_WEBHOOK_TOKEN = ""
            mock_settings.ENVIRONMENT = "test"
            mock_settings.ASAAS_E2E_MOCK = True
            r = client.post("/api/webhooks/asaas", json=payload)
        assert r.status_code == 200, r.text
        assert r.json().get("idempotent") is True


class TestReembolsoValorZero:
    def test_reembolso_valor_zero_bloqueado(self):
        from app.services.pagamento_asaas import reembolsar_cobranca

        try:
            reembolsar_cobranca("pay_teste", valor=0.0)
            assert False, "deveria ter levantado ValueError"
        except ValueError as e:
            assert "zero" in str(e).lower()
