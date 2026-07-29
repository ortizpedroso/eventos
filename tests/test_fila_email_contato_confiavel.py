"""Fila confiável do e-mail de contato + envio assíncrono (não bloqueia a tela)."""

from __future__ import annotations

import time
import uuid
from unittest.mock import patch

import pytest

from app.models.contato_site_mensagem import ContatoSiteMensagem
from app.services import contato_email
from app.services.redis_conn import get_redis_optional, reset_redis_client_for_tests
from config.settings import settings
from tests.fila_email_helpers import REDIS_URL_FILA_TESTES, parar_workers_email
from tests.test_api import TestingSessionLocal


def _fake_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture(autouse=True)
def _redis_disponivel(monkeypatch):
    parar_workers_email()
    monkeypatch.setattr(settings, "REDIS_URL", REDIS_URL_FILA_TESTES)
    monkeypatch.setattr(settings, "ENVIRONMENT", "development")
    monkeypatch.setattr(settings, "TICKET_EMAIL_USE_REDIS", True)
    # _send_sync usa `from app.models import get_db` — aponta pro mesmo banco de
    # teste usado pelo TestClient (tests/test_api.py), senão bate em "no such
    # table" (engine/arquivo SQLite isolado, diferente do que o conftest cria).
    monkeypatch.setattr("app.models.get_db", _fake_get_db)
    reset_redis_client_for_tests()
    r = get_redis_optional()
    assert r is not None, "Redis precisa estar disponível para estes testes"
    r.delete(contato_email._REDIS_QUEUE_KEY, contato_email._REDIS_PROCESSING_KEY)
    yield r
    parar_workers_email()
    r.delete(contato_email._REDIS_QUEUE_KEY, contato_email._REDIS_PROCESSING_KEY)
    reset_redis_client_for_tests()


def _criar_registro() -> str:
    db = TestingSessionLocal()
    try:
        registro = ContatoSiteMensagem(
            nome="Visitante Teste",
            email="visitante@teste.com",
            assunto="Assunto teste",
            mensagem="Mensagem de teste com mais de dez caracteres.",
            email_enviado=False,
        )
        db.add(registro)
        db.commit()
        db.refresh(registro)
        return registro.id
    finally:
        db.close()


class TestFilaConfiavelContato:
    def test_dequeue_move_para_processing_nao_descarta(self, _redis_disponivel):
        r = _redis_disponivel
        mensagem_id = f"msg_{uuid.uuid4().hex[:8]}"
        r.lpush(contato_email._REDIS_QUEUE_KEY, mensagem_id)

        obtido = contato_email._dequeue_next()

        assert obtido == mensagem_id
        assert r.lrange(contato_email._REDIS_QUEUE_KEY, 0, -1) == []
        assert mensagem_id in r.lrange(contato_email._REDIS_PROCESSING_KEY, 0, -1)

    def test_recupera_orfaos_de_processo_anterior_morto(self, _redis_disponivel):
        r = _redis_disponivel
        orfao = f"msg_orfao_{uuid.uuid4().hex[:8]}"
        r.lpush(contato_email._REDIS_PROCESSING_KEY, orfao)

        contato_email._recuperar_orfaos_processing()

        assert orfao in r.lrange(contato_email._REDIS_QUEUE_KEY, 0, -1)
        assert r.lrange(contato_email._REDIS_PROCESSING_KEY, 0, -1) == []

    def test_send_sync_marca_email_enviado_no_banco(self):
        mensagem_id = _criar_registro()
        with (
            patch("app.services.platform_settings.get_public_settings") as mock_settings,
            patch("app.services.smtp_client.smtp_configured", return_value=True),
            patch("app.services.smtp_client.send_email", return_value=True) as mock_send,
        ):
            mock_settings.return_value.contact_email = "dono@eventosbr.app.br"
            mock_settings.return_value.support_email = None
            ok = contato_email._send_sync(mensagem_id)

        assert ok is True
        # 2 envios: (1) notificação interna pra plataforma, (2) confirmação de
        # recebimento pro visitante que mandou a mensagem.
        assert mock_send.call_count == 2
        interno, confirmacao = mock_send.call_args_list
        assert interno.kwargs["destino"] == "dono@eventosbr.app.br"
        assert interno.kwargs["reply_to"] == "visitante@teste.com"
        assert confirmacao.kwargs["destino"] == "visitante@teste.com"
        assert "Recebemos sua mensagem" in confirmacao.kwargs["assunto"]
        assert "Visitante" in confirmacao.kwargs["corpo_texto"] or "Oi," in confirmacao.kwargs["corpo_texto"]
        assert "Assunto teste" in (confirmacao.kwargs.get("corpo_html") or "")

        db = TestingSessionLocal()
        try:
            registro = db.get(ContatoSiteMensagem, mensagem_id)
            assert registro.email_enviado is True
        finally:
            db.close()

    def test_falha_na_confirmacao_nao_quebra_envio_principal(self):
        """Se o e-mail de confirmação pro remetente falhar por qualquer motivo, o
        envio principal (já confirmado com sucesso) não deve ser afetado."""
        mensagem_id = _criar_registro()
        with (
            patch("app.services.platform_settings.get_public_settings") as mock_settings,
            patch("app.services.smtp_client.smtp_configured", return_value=True),
            patch("app.services.smtp_client.send_email") as mock_send,
        ):
            mock_settings.return_value.contact_email = "dono@eventosbr.app.br"
            mock_settings.return_value.support_email = None
            # 1ª chamada (interna) sucesso, 2ª (confirmação) explode
            mock_send.side_effect = [True, Exception("falha simulada no SMTP")]
            ok = contato_email._send_sync(mensagem_id)

        assert ok is True
        db = TestingSessionLocal()
        try:
            registro = db.get(ContatoSiteMensagem, mensagem_id)
            assert registro.email_enviado is True
        finally:
            db.close()

    def test_falha_smtp_reenfileira_em_vez_de_descartar(self, monkeypatch, _redis_disponivel):
        """Regressão: falha SMTP marcava processado sem retry — UI dizia ok e o
        e-mail sumia. Agora reenfileira até MAX_ATTEMPTS."""
        monkeypatch.setattr(settings, "TICKET_EMAIL_MAX_ATTEMPTS", 2)
        r = _redis_disponivel
        mensagem_id = _criar_registro()

        with (
            patch("app.services.platform_settings.get_public_settings") as mock_settings,
            patch("app.services.smtp_client.smtp_configured", return_value=True),
            patch("app.services.smtp_client.send_email", return_value=False),
        ):
            mock_settings.return_value.contact_email = "dono@eventosbr.app.br"
            mock_settings.return_value.support_email = None
            r.lpush(contato_email._REDIS_QUEUE_KEY, mensagem_id)
            assert contato_email._send_sync(mensagem_id) is False
            contato_email._schedule_retry(mensagem_id)
            # Após 1ª falha deve voltar pra fila principal
            assert mensagem_id in r.lrange(contato_email._REDIS_QUEUE_KEY, 0, -1)

        db = TestingSessionLocal()
        try:
            registro = db.get(ContatoSiteMensagem, mensagem_id)
            assert registro.email_enviado is False
        finally:
            db.close()

    def test_enfileirar_processa_em_segundo_plano(self, _redis_disponivel):
        """A chamada de enfileirar deve retornar na hora (não espera o SMTP) — o
        processamento de verdade acontece no worker em background."""
        r = _redis_disponivel
        mensagem_id = _criar_registro()

        with (
            patch("app.services.platform_settings.get_public_settings") as mock_settings,
            patch("app.services.smtp_client.smtp_configured", return_value=True),
            patch("app.services.smtp_client.send_email", return_value=True),
        ):
            mock_settings.return_value.contact_email = "dono@eventosbr.app.br"
            mock_settings.return_value.support_email = None

            inicio = time.monotonic()
            contato_email.enqueue_contato_email(mensagem_id)
            duracao = time.monotonic() - inicio
            assert duracao < 1.0, "enfileirar não deveria bloquear esperando o SMTP"

            for _ in range(30):
                db = TestingSessionLocal()
                try:
                    registro = db.get(ContatoSiteMensagem, mensagem_id)
                    enviado = registro.email_enviado
                finally:
                    db.close()
                if enviado:
                    break
                time.sleep(0.2)
            else:
                pytest.fail("worker não processou a mensagem em segundo plano a tempo")

        contato_email.stop_contato_email_worker(aguardar_segundos=5)
        if contato_email._worker_thread is not None:
            contato_email._worker_thread.join(timeout=5)
