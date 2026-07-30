"""Contato obrigatório na criação de evento + formulário público de contato."""

from __future__ import annotations

import uuid
from unittest.mock import patch

from fastapi.testclient import TestClient

from app.main import app
from config.settings import settings

client = TestClient(app)


def _registrar_organizador(email: str) -> str:
    r = client.post(
        "/api/auth/registrar",
        json={"email": email, "nome": "Org Contato", "senha": "senha-forte-123", "tipo": "organizador"},
    )
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


def _payload_evento(**overrides) -> dict:
    base = {
        "nome": f"Evento {uuid.uuid4().hex[:6]}",
        "descricao": "Teste",
        "data_inicio": "2026-12-01T10:00:00",
        "data_fim": "2026-12-01T22:00:00",
        "local": "SP",
        "preco_ingresso": 50,
        "categoria": "Outros",
        "contato_telefone": "11987654321",
        "contato_email": "contato@teste.com",
        "publicado": False,
        "ingresso_lotes": [{"nome": "Geral", "preco": 50, "ordem": 1, "ativo": True}],
    }
    base.update(overrides)
    return base


class TestContatoObrigatorioEvento:
    def test_criar_evento_sem_telefone_falha(self):
        token = _registrar_organizador(f"contato1_{uuid.uuid4().hex[:8]}@teste.com")
        payload = _payload_evento()
        del payload["contato_telefone"]
        r = client.post(
            "/api/eventos/criar", json=payload, headers={"Authorization": f"Bearer {token}"}
        )
        assert r.status_code == 422
        assert any(err["loc"][-1] == "contato_telefone" for err in r.json()["detail"])

    def test_criar_evento_sem_email_falha(self):
        token = _registrar_organizador(f"contato2_{uuid.uuid4().hex[:8]}@teste.com")
        payload = _payload_evento()
        del payload["contato_email"]
        r = client.post(
            "/api/eventos/criar", json=payload, headers={"Authorization": f"Bearer {token}"}
        )
        assert r.status_code == 422
        assert any(err["loc"][-1] == "contato_email" for err in r.json()["detail"])

    def test_criar_evento_telefone_curto_falha(self):
        token = _registrar_organizador(f"contato3_{uuid.uuid4().hex[:8]}@teste.com")
        payload = _payload_evento(contato_telefone="123")
        r = client.post(
            "/api/eventos/criar", json=payload, headers={"Authorization": f"Bearer {token}"}
        )
        assert r.status_code == 422

    def test_criar_evento_com_contato_valido_sucesso(self):
        token = _registrar_organizador(f"contato4_{uuid.uuid4().hex[:8]}@teste.com")
        payload = _payload_evento(contato_telefone="(11) 98765-4321", contato_email="fala@evento.com")
        r = client.post(
            "/api/eventos/criar", json=payload, headers={"Authorization": f"Bearer {token}"}
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["contato_telefone"] == "11987654321"
        assert body["contato_email"] == "fala@evento.com"


class TestFormularioContatoPublico:
    def test_contato_salva_mesmo_sem_smtp(self, monkeypatch):
        monkeypatch.setattr(settings, "TURNSTILE_SECRET_KEY", "")
        with patch("app.routes.public.get_public_settings") as mock_settings:
            mock_settings.return_value.contact_email = None
            mock_settings.return_value.support_email = None
            r = client.post(
                "/api/public/contato",
                json={
                    "nome": "Visitante",
                    "email": "visitante@teste.com",
                    "assunto": "Dúvida",
                    "mensagem": "Mensagem de teste com mais de dez caracteres.",
                },
            )
        assert r.status_code == 200, r.text
        assert "sucesso" in r.json()["message"].lower()

    def test_contato_enfileira_email_com_sucesso(self, monkeypatch):
        """Envio agora é assíncrono (services/contato_email.py) — a rota só precisa
        enfileirar e responder rápido, sem esperar o SMTP de verdade."""
        monkeypatch.setattr(settings, "TURNSTILE_SECRET_KEY", "")
        with (
            patch("app.routes.public.get_public_settings") as mock_settings,
            patch("app.services.smtp_client.smtp_configured", return_value=True),
            patch("app.services.contato_email.enqueue_contato_email") as mock_enqueue,
        ):
            mock_settings.return_value.contact_email = "dono@eventosbr.app.br"
            mock_settings.return_value.support_email = None
            r = client.post(
                "/api/public/contato",
                json={
                    "nome": "Visitante",
                    "email": "visitante@teste.com",
                    "assunto": "Dúvida sobre reembolso",
                    "mensagem": "Mensagem de teste com mais de dez caracteres.",
                },
            )
        assert r.status_code == 200, r.text
        assert "enviada com sucesso" in r.json()["message"].lower()
        assert r.json()["email_enviado"] is True
        mock_enqueue.assert_called_once()

    def test_contato_mensagem_curta_rejeitada(self):
        r = client.post(
            "/api/public/contato",
            json={
                "nome": "Visitante",
                "email": "visitante@teste.com",
                "assunto": "Oi",
                "mensagem": "curta",
            },
        )
        assert r.status_code == 422


class TestOrganizadorNomeNaRespostaPublica:
    """Regressão: response_model=EventoResponse (rota pública) não incluía
    organizador_nome — o campo só existia numa subclasse EventoPublicoResponse
    que nunca era usada de verdade, então o nome do organizador nunca chegava
    no frontend mesmo a UI já estando pronta para exibi-lo."""

    def test_evento_publico_retorna_nome_do_organizador_cadastrado(self):
        token = _registrar_organizador(f"orgnome_{uuid.uuid4().hex[:8]}@teste.com")
        headers = {"Authorization": f"Bearer {token}"}
        r = client.post(
            "/api/eventos/criar",
            json=_payload_evento(publicado=True),
            headers=headers,
        )
        assert r.status_code == 200, r.text
        slug = r.json()["slug"]

        r2 = client.get(f"/api/eventos/{slug}")
        assert r2.status_code == 200, r2.text
        assert r2.json()["organizador_nome"] == "Org Contato"

    def test_organizador_nome_prioriza_marca_cadastrada_no_perfil(self):
        """Se o organizador configurou um nome de marca (brand_name) no perfil
        (whitelabel), a página pública do evento deve mostrar esse nome — não
        o nome genérico da conta usado no cadastro."""
        token = _registrar_organizador(f"orgmarca_{uuid.uuid4().hex[:8]}@teste.com")
        headers = {"Authorization": f"Bearer {token}"}

        r_perfil = client.patch(
            "/api/produtor/meu-perfil",
            json={"brand_name": "Produtora XPTO Eventos"},
            headers=headers,
        )
        assert r_perfil.status_code == 200, r_perfil.text

        r = client.post("/api/eventos/criar", json=_payload_evento(publicado=True), headers=headers)
        assert r.status_code == 200, r.text
        slug = r.json()["slug"]

        r2 = client.get(f"/api/eventos/{slug}")
        assert r2.status_code == 200, r2.text
        assert r2.json()["organizador_nome"] == "Produtora XPTO Eventos"
