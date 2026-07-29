"""Fila confiável de e-mail simples — bug do .decode() e recuperação após crash."""

from __future__ import annotations

import time
import uuid

import pytest

from app.services import notificacao_email
from app.services.redis_conn import get_redis_optional, reset_redis_client_for_tests
from config.settings import settings
from tests.fila_email_helpers import REDIS_URL_FILA_TESTES, parar_workers_email


@pytest.fixture(autouse=True)
def _redis_disponivel(monkeypatch):
    parar_workers_email()
    monkeypatch.setattr(settings, "REDIS_URL", REDIS_URL_FILA_TESTES)
    monkeypatch.setattr(settings, "ENVIRONMENT", "development")
    monkeypatch.setattr(settings, "TICKET_EMAIL_USE_REDIS", True)
    reset_redis_client_for_tests()
    r = get_redis_optional()
    assert r is not None, "Redis precisa estar disponível para estes testes"
    r.delete(notificacao_email._REDIS_KEY, notificacao_email._REDIS_PROCESSING_KEY)
    yield r
    parar_workers_email()
    r.delete(notificacao_email._REDIS_KEY, notificacao_email._REDIS_PROCESSING_KEY)
    reset_redis_client_for_tests()


class TestBugDecodeCorrigido:
    def test_dequeue_nao_gera_attributeerror_com_decode_responses(self, _redis_disponivel):
        """Bug original: blpop + .decode() numa string (decode_responses=True já
        retorna str) levantava AttributeError, capturada pelo except genérico —
        o payload já tinha sido removido da fila (blpop é destrutivo) e se perdia
        pra sempre. Toda mensagem via Redis (onboarding, saque, lista de
        espera/interesse) era afetada."""
        r = _redis_disponivel
        payload = notificacao_email._payload("destino@teste.com", "Assunto", "<p>html</p>")
        r.rpush(notificacao_email._REDIS_KEY, payload)

        obtido = notificacao_email._dequeue_next()

        assert obtido == payload
        destino, assunto, html = notificacao_email._parse(obtido)
        assert destino == "destino@teste.com"
        assert assunto == "Assunto"


class TestFilaConfiavel:
    def test_dequeue_move_para_processing_nao_descarta(self, _redis_disponivel):
        r = _redis_disponivel
        payload = notificacao_email._payload(f"{uuid.uuid4().hex[:8]}@teste.com", "A", "H")
        r.rpush(notificacao_email._REDIS_KEY, payload)

        notificacao_email._dequeue_next()

        assert r.lrange(notificacao_email._REDIS_KEY, 0, -1) == []
        assert payload in r.lrange(notificacao_email._REDIS_PROCESSING_KEY, 0, -1)

    def test_marcar_processado_remove_da_processing(self, _redis_disponivel):
        r = _redis_disponivel
        payload = notificacao_email._payload(f"{uuid.uuid4().hex[:8]}@teste.com", "A", "H")
        r.rpush(notificacao_email._REDIS_KEY, payload)
        notificacao_email._dequeue_next()

        notificacao_email._marcar_processado(payload)

        assert payload not in r.lrange(notificacao_email._REDIS_PROCESSING_KEY, 0, -1)

    def test_recupera_orfaos_de_processo_anterior_morto(self, _redis_disponivel):
        r = _redis_disponivel
        payload = notificacao_email._payload("orfao@teste.com", "A", "H")
        r.lpush(notificacao_email._REDIS_PROCESSING_KEY, payload)

        notificacao_email._recuperar_orfaos_processing()

        assert payload in r.lrange(notificacao_email._REDIS_KEY, 0, -1)
        assert r.lrange(notificacao_email._REDIS_PROCESSING_KEY, 0, -1) == []

    def test_enfileirar_e_processar_ponta_a_ponta(self, monkeypatch, _redis_disponivel):
        """Com SMTP off o envio falha de verdade (não finge sucesso); com
        MAX_ATTEMPTS=1 o worker abandona e limpa a fila sem ciclar."""
        monkeypatch.setattr(settings, "EMAIL_USER", "")
        monkeypatch.setattr(settings, "EMAIL_PASSWORD", "")
        monkeypatch.setattr(settings, "TICKET_EMAIL_MAX_ATTEMPTS", 1)
        r = _redis_disponivel

        ok = notificacao_email.enqueue_email_simples("destino@teste.com", "Assunto teste", "<p>oi</p>")
        assert ok is True

        for _ in range(40):
            fila = r.lrange(notificacao_email._REDIS_KEY, 0, -1)
            processando = r.lrange(notificacao_email._REDIS_PROCESSING_KEY, 0, -1)
            if not fila and not processando:
                break
            time.sleep(0.2)
        else:
            pytest.fail("mensagem não foi processada nem limpa das filas")

        notificacao_email.stop_email_simples_worker(aguardar_segundos=5)
        if notificacao_email._worker_thread is not None:
            notificacao_email._worker_thread.join(timeout=5)
