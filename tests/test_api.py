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
        response = client.get("/api/eventos/")
        assert response.status_code == 200
        assert len(response.json()) > 0


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
