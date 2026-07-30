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
                "contato_telefone": "11987654321",
                "contato_email": "contato@teste.com",
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
                "contato_telefone": "11987654321",
                "contato_email": "contato@teste.com",
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
                "contato_telefone": "11987654321",
                "contato_email": "contato@teste.com",
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
                "contato_telefone": "11987654321",
                "contato_email": "contato@teste.com",
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
                "contato_telefone": "11987654321",
                "contato_email": "contato@teste.com",
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
                "contato_telefone": "11987654321",
                "contato_email": "contato@teste.com",
                "publicado": True,
                "ingresso_lotes": [{"nome": "Geral", "preco": 10, "ordem": 1, "ativo": True}],
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

    def test_compra_rapida_primeiro_acesso_via_recuperacao(self):
        """Conta sem senha (compra rápida) recebe link de primeiro acesso e consegue entrar."""
        r = client.post(
            "/api/auth/compra-rapida",
            json={"nome": "Convidado Rapido", "email": "primeiro.acesso@test.com"},
        )
        assert r.status_code == 200, r.text

        login_sem = client.post(
            "/api/auth/login",
            json={"email": "primeiro.acesso@test.com", "senha": "qualquer123"},
        )
        assert login_sem.status_code == 401
        assert "primeiro acesso" in login_sem.json()["detail"].lower()

        with patch("app.routes.auth.enviar_email_recuperacao_senha") as send_mail:
            send_mail.return_value = True
            rec = client.post(
                "/api/auth/solicitar-recuperacao-senha",
                json={"email": "primeiro.acesso@test.com"},
            )
        assert rec.status_code == 200
        assert send_mail.called
        assert send_mail.call_args.kwargs.get("primeiro_acesso") is True

        db = TestingSessionLocal()
        from app.models import Usuario

        u = db.query(Usuario).filter(Usuario.email == "primeiro.acesso@test.com").first()
        assert u and u.senha_reset_token and not u.senha_hash
        token = u.senha_reset_token
        db.close()

        r2 = client.post(
            "/api/auth/redefinir-senha",
            json={"token": token, "nova_senha": "minhaSenha99"},
        )
        assert r2.status_code == 200, r2.text

        login = client.post(
            "/api/auth/login",
            json={"email": "primeiro.acesso@test.com", "senha": "minhaSenha99"},
        )
        assert login.status_code == 200, login.text


class TestIngressoImpressaoHtml:
    def test_download_html_permite_script_print(self):
        """CSP do HTML de impressão deve permitir script (senão o botão não chama a impressora)."""
        from datetime import datetime, timedelta, timezone

        from app.models import Evento, Ingresso, Usuario
        from app.services.auth import hash_password

        db = TestingSessionLocal()
        org = Usuario(
            email="org.print@test.com",
            nome="Org Print",
            senha_hash=hash_password("senha12345"),
            tipo="organizador",
        )
        cliente = Usuario(
            email="cli.print@test.com",
            nome="Cli Print",
            senha_hash=hash_password("senha12345"),
            tipo="cliente",
        )
        db.add_all([org, cliente])
        db.commit()
        db.refresh(org)
        db.refresh(cliente)

        agora = datetime.now(timezone.utc).replace(tzinfo=None)
        ev = Evento(
            nome="Show Print",
            descricao="desc",
            data_inicio=agora + timedelta(days=3),
            data_fim=agora + timedelta(days=3, hours=2),
            local="Arena",
            cidade="SP",
            categoria="Shows",
            preco_ingresso=40.0,
            organizador_id=org.id,
            slug="show-print-test",
            publicado=True,
        )
        db.add(ev)
        db.commit()
        db.refresh(ev)

        ing = Ingresso(
            evento_id=ev.id,
            usuario_id=cliente.id,
            participante_nome="Cli Print",
            participante_email="cli.print@test.com",
            valor=40.0,
            status="pago",
        )
        db.add(ing)
        db.commit()
        db.refresh(ing)
        ingresso_id = ing.id
        db.close()

        login = client.post(
            "/api/auth/login",
            json={"email": "cli.print@test.com", "senha": "senha12345"},
        )
        assert login.status_code == 200, login.text
        token = login.json()["access_token"]

        resp = client.get(
            f"/api/ingressos/{ingresso_id}/download",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200, resp.text
        html = resp.text
        assert "script-src 'unsafe-inline'" in html
        assert "window.print()" in html
        assert 'id="btn-imprimir"' in html


class TestWebhookIdempotencia:
    def test_webhook_asaas_idempotente(self):
        from unittest.mock import patch

        from config.settings import settings

        prev = settings.ASAAS_WEBHOOK_TOKEN
        settings.ASAAS_WEBHOOK_TOKEN = "tok_test"
        try:
            payload = {
                "id": "evt_asaas_test_123",
                "event": "PAYMENT_RECEIVED",
                "payment": {"id": "pay_test_123"},
            }
            headers = {"asaas-access-token": "tok_test", "content-type": "application/json"}
            with patch(
                "app.services.pagamento_asaas.obter_cobranca",
                return_value={"id": "pay_test_123", "status": "RECEIVED"},
            ):
                r1 = client.post("/api/webhooks/asaas", json=payload, headers=headers)
                assert r1.status_code == 200
                r2 = client.post("/api/webhooks/asaas", json=payload, headers=headers)
            assert r2.status_code == 200
            assert r2.json().get("idempotent") is True
        finally:
            settings.ASAAS_WEBHOOK_TOKEN = prev

if __name__ == "__main__":
    pytest.main([__file__, "-v"])
