"""
Testes básicos para a API EventosBR
"""

from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.main import app
from config.database import Base
from app.models import get_db

# Database de teste
SQLALCHEMY_DATABASE_URL = "sqlite+pysqlite:///:memory:"
engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base.metadata.create_all(bind=engine)

def override_get_db():
    try:
        db = TestingSessionLocal()
        yield db
    finally:
        db.close()

app.dependency_overrides[get_db] = override_get_db
client = TestClient(app)

@pytest.fixture(autouse=True)
def _mock_stripe_calls():
    """
    Evita chamadas externas ao Stripe durante os testes.
    """
    with (
        patch("stripe.Customer.create") as customer_create,
        patch("stripe.Account.create") as account_create,
        patch("stripe.PaymentIntent.create") as payment_intent_create,
        patch("stripe.Refund.create") as refund_create,
    ):
        customer_create.return_value = type("Customer", (), {"id": "cus_test_123"})()
        account_create.return_value = type("Account", (), {"id": "acct_test_123"})()
        payment_intent_create.return_value = type(
            "PaymentIntent",
            (),
            {"id": "pi_test_123", "client_secret": "pi_test_secret_123"},
        )()
        refund_create.return_value = type("Refund", (), {"id": "re_test_123"})()
        yield

class TestHealth:
    def test_health_check(self):
        """Liveness: responde 200 sem depender da BD."""
        response = client.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ok"
        assert data.get("role") == "liveness"

    def test_ready_ok(self):
        """Readiness com BD disponível."""
        response = client.get("/ready")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ok"
        assert data["database"] == "up"
        assert data.get("role") == "readiness"

    def test_ready_unavailable_when_db_fails(self):
        """Readiness devolve 503 se a sessão não consegue consultar a BD."""

        def override_get_db_broken():
            class _Broken:
                def execute(self, *_a, **_kw):
                    raise RuntimeError("database unavailable")

                def close(self):
                    pass

            yield _Broken()

        app.dependency_overrides[get_db] = override_get_db_broken
        try:
            response = client.get("/ready")
            assert response.status_code == 503
            data = response.json()
            assert data["status"] == "unavailable"
            assert data["database"] == "down"
        finally:
            app.dependency_overrides[get_db] = override_get_db

    def test_root(self):
        """Testa endpoint raiz"""
        response = client.get("/")
        assert response.status_code == 200
        assert "EventosBR API" in response.json()["message"]

class TestAuth:
    def test_registrar_usuario(self):
        """Testa registro de novo usuário"""
        response = client.post(
            "/api/auth/registrar",
            json={
                "email": "teste@exemplo.com",
                "nome": "Teste User",
                "senha": "senha123",
                "tipo": "cliente"
            }
        )
        assert response.status_code == 200
        assert "access_token" in response.json()
        assert response.json()["usuario"]["email"] == "teste@exemplo.com"

    def test_registrar_tipo_maiusculo_normalizado(self):
        """Organizador com maiúsculas vira organizador"""
        response = client.post(
            "/api/auth/registrar",
            json={
                "email": "orgcase@exemplo.com",
                "nome": "Org",
                "senha": "senha123",
                "tipo": "Organizador",
            },
        )
        assert response.status_code == 200
        assert response.json()["usuario"]["tipo"] == "organizador"

    def test_registrar_email_duplicado(self):
        """Testa registro com email duplicado"""
        # Primeiro registro
        client.post(
            "/api/auth/registrar",
            json={
                "email": "duplicado@exemplo.com",
                "nome": "Primeiro",
                "senha": "senha123",
                "tipo": "cliente"
            }
        )
        
        # Segundo registro com mesmo email
        response = client.post(
            "/api/auth/registrar",
            json={
                "email": "duplicado@exemplo.com",
                "nome": "Segundo",
                "senha": "senha123",
                "tipo": "cliente"
            }
        )
        assert response.status_code == 400
        assert "Email já cadastrado" in response.json()["detail"]

    def test_registrar_senha_curta_rejeitada(self):
        response = client.post(
            "/api/auth/registrar",
            json={
                "email": "curta@exemplo.com",
                "nome": "Curta",
                "senha": "1234567",
                "tipo": "cliente",
            },
        )
        assert response.status_code == 422

    def test_login_sucesso(self):
        """Testa login bem-sucedido"""
        # Registra primeiro
        client.post(
            "/api/auth/registrar",
            json={
                "email": "login@exemplo.com",
                "nome": "Login User",
                "senha": "senha123",
                "tipo": "cliente"
            }
        )
        
        # Faz login
        response = client.post(
            "/api/auth/login",
            json={
                "email": "login@exemplo.com",
                "senha": "senha123"
            }
        )
        assert response.status_code == 200
        assert "access_token" in response.json()

    def test_login_senha_incorreta(self):
        """Testa login com senha incorreta"""
        # Registra
        client.post(
            "/api/auth/registrar",
            json={
                "email": "senha@exemplo.com",
                "nome": "Senha User",
                "senha": "correta123",
                "tipo": "cliente"
            }
        )
        
        # Tenta login com senha errada
        response = client.post(
            "/api/auth/login",
            json={
                "email": "senha@exemplo.com",
                "senha": "incorreta123"
            }
        )
        assert response.status_code == 401
        assert "Email ou senha incorretos" in response.json()["detail"]

class TestEventos:
    def setup_method(self):
        """Setup para cada teste"""
        # Registra e faz login de um organizador
        response = client.post(
            "/api/auth/registrar",
            json={
                "email": f"organizador{id(self)}@exemplo.com",
                "nome": "Organizador Test",
                "senha": "senha123",
                "tipo": "organizador"
            }
        )
        self.token = response.json()["access_token"]
        self.headers = {"Authorization": f"Bearer {self.token}"}

    def test_criar_evento(self):
        """Testa criação de evento"""
        response = client.post(
            "/api/eventos/criar",
            headers=self.headers,
            json={
                "nome": "Evento Teste",
                "descricao": "Descrição do evento",
                "data_inicio": "2025-06-15T09:00:00",
                "data_fim": "2025-06-15T18:00:00",
                "local": "São Paulo, SP",
                "imagem_url": None,
                "preco_ingresso": 75.5,
                "categoria": "Tecnologia",
                "mensagem_confirmacao": "Obrigado pela inscrição!",
            }
        )
        assert response.status_code == 200
        assert response.json()["nome"] == "Evento Teste"
        assert response.json()["preco_ingresso"] == 75.5
        assert len(response.json().get("ingresso_lotes") or []) >= 1
        assert "slug" in response.json()

    def test_criar_evento_categoria_invalida(self):
        response = client.post(
            "/api/eventos/criar",
            headers=self.headers,
            json={
                "nome": "Evento categoria inválida",
                "descricao": "Teste",
                "data_inicio": "2025-06-15T09:00:00",
                "local": "São Paulo, SP",
                "preco_ingresso": 10,
                "categoria": "CategoriaInexistente",
            },
        )
        assert response.status_code == 422

    def test_criar_evento_categoria_gastronomia(self):
        response = client.post(
            "/api/eventos/criar",
            headers=self.headers,
            json={
                "nome": "Feijoada beneficente",
                "descricao": "Gastronomia",
                "data_inicio": "2025-07-01T12:00:00",
                "local": "Centro",
                "preco_ingresso": 35,
                "categoria": "Gastronomia",
            },
        )
        assert response.status_code == 200
        assert response.json()["categoria"] == "Gastronomia"

    def test_criar_evento_com_dois_lotes(self):
        """Lotes com preços distintos: resposta inclui ambos e preço mínimo sincronizado."""
        response = client.post(
            "/api/eventos/criar",
            headers=self.headers,
            json={
                "nome": "Evento dois lotes",
                "descricao": "Teste lotes",
                "data_inicio": "2025-09-01T10:00:00",
                "data_fim": "2025-09-01T22:00:00",
                "local": "Centro",
                "imagem_url": None,
                "preco_ingresso": 100,
                "categoria": "Outros",
                "ingresso_lotes": [
                    {"nome": "1º lote", "preco": 40, "ordem": 1, "ativo": True},
                    {"nome": "2º lote", "preco": 80, "ordem": 2, "ativo": True},
                ],
            },
        )
        assert response.status_code == 200
        body = response.json()
        assert len(body["ingresso_lotes"]) == 2
        assert body["preco_ingresso"] == 40
        assert body["preco_compra"] == 40

    def test_criar_evento_sem_data_fim(self):
        """Evento de um dia: data_fim omitida replica início."""
        response = client.post(
            "/api/eventos/criar",
            headers=self.headers,
            json={
                "nome": "Show um dia",
                "descricao": "Só início",
                "data_inicio": "2025-08-01T20:00:00",
                "local": "Teatro",
                "imagem_url": None,
                "preco_ingresso": 50,
                "categoria": "Música",
            },
        )
        assert response.status_code == 200
        body = response.json()
        assert body["data_fim"] == body["data_inicio"]

    def test_listar_eventos(self):
        """Testa listagem de eventos"""
        # Cria um evento primeiro
        client.post(
            "/api/eventos/criar",
            headers=self.headers,
            json={
                "nome": "Evento Lista",
                "descricao": "Para listar",
                "data_inicio": "2025-07-15T09:00:00",
                "data_fim": "2025-07-15T12:00:00",
                "local": "Rio de Janeiro, RJ",
                "imagem_url": None,
                "preco_ingresso": 10,
                "categoria": "Outros",
            }
        )
        
        # Lista eventos
        response = client.get("/api/eventos")
        assert response.status_code == 200
        assert len(response.json()) > 0


class TestCompraRapidaPerfil:
    def test_compra_rapida_tem_senha_false(self):
        r = client.post(
            "/api/auth/compra-rapida",
            json={"nome": "Convidado", "email": "convidado@test.com"},
        )
        assert r.status_code == 200, r.text
        token = r.json()["access_token"]
        me = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
        assert me.status_code == 200
        assert me.json()["tem_senha"] is False
        assert me.json()["email_verificado"] is False

    def test_compra_rapida_define_primeira_senha_sem_senha_atual(self):
        r = client.post(
            "/api/auth/compra-rapida",
            json={"nome": "Davi Teste", "email": "davi.perfil@test.com"},
        )
        assert r.status_code == 200, r.text
        token = r.json()["access_token"]
        h = {"Authorization": f"Bearer {token}"}
        patch = client.patch(
            "/api/auth/me",
            headers=h,
            json={
                "nome": "Davi Teste",
                "email": "davi.perfil@test.com",
                "nova_senha": "senha12345",
            },
        )
        assert patch.status_code == 200, patch.text
        assert patch.json()["tem_senha"] is True

        login = client.post(
            "/api/auth/login",
            json={"email": "davi.perfil@test.com", "senha": "senha12345"},
        )
        assert login.status_code == 200, login.text

    def test_verificar_email_com_token(self):
        with patch("app.services.email_verificacao.enviar_email_verificacao", return_value=True):
            r = client.post(
                "/api/auth/compra-rapida",
                json={"nome": "Verify", "email": "verify@test.com"},
            )
            assert r.status_code == 200, r.text
        from app.models import Usuario

        db = TestingSessionLocal()
        try:
            u = db.query(Usuario).filter(Usuario.email == "verify@test.com").first()
            assert u is not None
            assert u.email_verificado is False
            token = u.email_verificacao_token
            assert token
        finally:
            db.close()

        ok = client.post("/api/auth/verificar-email", json={"token": token})
        assert ok.status_code == 200, ok.text
        me = client.get("/api/auth/me", headers={"Authorization": f"Bearer {r.json()['access_token']}"})
        assert me.json()["email_verificado"] is True


class TestRetomarPagamento:
    def test_retomar_pagamento_pendente(self):
        org = client.post(
            "/api/auth/registrar",
            json={
                "email": "org_ret@test.com",
                "nome": "Org",
                "senha": "senha12345",
                "tipo": "organizador",
            },
        ).json()["access_token"]
        cli = client.post(
            "/api/auth/registrar",
            json={
                "email": "cli_ret@test.com",
                "nome": "Cli",
                "senha": "senha12345",
                "tipo": "cliente",
            },
        ).json()["access_token"]

        ev = client.post(
            "/api/eventos/criar",
            headers={"Authorization": f"Bearer {org}"},
            json={
                "nome": "Evento Retomar",
                "descricao": "d",
                "data_inicio": "2026-12-01T10:00:00",
                "data_fim": "2026-12-01T22:00:00",
                "local": "SP",
                "preco_ingresso": 50,
                "categoria": "Outros",
                "ingresso_lotes": [{"nome": "Geral", "preco": 50, "ordem": 1, "ativo": True}],
            },
        ).json()

        pay = client.post(
            "/api/pagamentos/criar",
            headers={"Authorization": f"Bearer {cli}"},
            json={
                "evento_id": ev["id"],
                "valor_centavos": 5000,
                "termo_compra_aceito": True,
            },
        )
        assert pay.status_code == 200, pay.text
        ingresso_id = pay.json()["ingresso_id"]

        with patch("stripe.PaymentIntent.retrieve") as retrieve:
            retrieve.return_value = type(
                "PaymentIntent",
                (),
                {
                    "id": "pi_test_123",
                    "client_secret": "pi_test_secret_123",
                    "status": "requires_payment_method",
                    "payment_method_types": ["card", "pix"],
                },
            )()
            ret = client.post(
                "/api/pagamentos/retomar",
                headers={"Authorization": f"Bearer {cli}"},
                json={"ingresso_id": ingresso_id, "evento_id": ev["id"]},
            )
        assert ret.status_code == 200, ret.text
        body = ret.json()
        assert body["ingresso_id"] == ingresso_id
        assert body["client_secret"] == "pi_test_secret_123"
        assert body.get("evento_slug")


class TestRecuperacaoSenha:
    def test_solicitar_e_redefinir_senha(self):
        client.post(
            "/api/auth/registrar",
            json={
                "email": "reset@test.com",
                "nome": "Reset",
                "senha": "senha12345",
                "tipo": "cliente",
            },
        )
        with patch("app.routes.auth.enviar_email_recuperacao_senha") as send_mail:
            send_mail.return_value = True
            r = client.post(
                "/api/auth/solicitar-recuperacao-senha",
                json={"email": "reset@test.com"},
            )
        assert r.status_code == 200
        assert "message" in r.json()
        assert send_mail.called

        db = TestingSessionLocal()
        from app.models import Usuario

        u = db.query(Usuario).filter(Usuario.email == "reset@test.com").first()
        assert u and u.senha_reset_token
        token = u.senha_reset_token
        db.close()

        r2 = client.post(
            "/api/auth/redefinir-senha",
            json={"token": token, "nova_senha": "novaSenha99"},
        )
        assert r2.status_code == 200, r2.text

        login = client.post(
            "/api/auth/login",
            json={"email": "reset@test.com", "senha": "novaSenha99"},
        )
        assert login.status_code == 200, login.text


class TestWebhookIdempotencia:
    def test_webhook_idempotente(self):
        payload = b'{"id":"evt_test_123","type":"payment_intent.succeeded","data":{"object":{"id":"pi_test_123"}}}'

        with patch("stripe.Webhook.construct_event") as construct_event:
            construct_event.return_value = {
                "id": "evt_test_123",
                "type": "payment_intent.succeeded",
                "data": {"object": {"id": "pi_test_123"}},
            }

            r1 = client.post("/api/webhooks/stripe", data=payload, headers={"stripe-signature": "sig"})
            assert r1.status_code == 200

            r2 = client.post("/api/webhooks/stripe", data=payload, headers={"stripe-signature": "sig"})
            assert r2.status_code == 200
            assert r2.json().get("idempotent") is True

if __name__ == "__main__":
    pytest.main([__file__, "-v"])
