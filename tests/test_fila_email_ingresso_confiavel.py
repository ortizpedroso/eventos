"""Fila confiável de e-mail de ingresso — recuperação após crash/deploy."""

from __future__ import annotations

import time
import uuid

import pytest

from app.services import ticket_email
from app.services.redis_conn import get_redis_optional, reset_redis_client_for_tests
from config.settings import settings
from tests.fila_email_helpers import REDIS_URL_FILA_TESTES, parar_workers_email


@pytest.fixture(autouse=True)
def _redis_disponivel(monkeypatch):
    """Aponta pro Redis local do sandbox e garante limpeza das chaves de teste."""
    # Para workers antes de habilitar Redis — senão um worker vivo (de outro
    # teste) começa a fazer blmove nas mesmas chaves e compete com _dequeue_next.
    parar_workers_email()
    monkeypatch.setattr(settings, "REDIS_URL", REDIS_URL_FILA_TESTES)
    monkeypatch.setattr(settings, "ENVIRONMENT", "development")
    monkeypatch.setattr(settings, "TICKET_EMAIL_USE_REDIS", True)
    reset_redis_client_for_tests()
    r = get_redis_optional()
    assert r is not None, "Redis precisa estar disponível para estes testes"
    r.delete(ticket_email._REDIS_QUEUE_KEY, ticket_email._REDIS_PROCESSING_KEY)
    yield r
    parar_workers_email()
    r.delete(ticket_email._REDIS_QUEUE_KEY, ticket_email._REDIS_PROCESSING_KEY)
    reset_redis_client_for_tests()


class TestFilaConfiavel:
    def test_dequeue_move_para_processing_nao_descarta(self, _redis_disponivel):
        r = _redis_disponivel
        ingresso_id = f"ing_{uuid.uuid4().hex[:8]}"
        r.lpush(ticket_email._REDIS_QUEUE_KEY, ingresso_id)

        obtido = ticket_email._dequeue_next()

        assert obtido == ingresso_id
        # Saiu da fila principal...
        assert r.lrange(ticket_email._REDIS_QUEUE_KEY, 0, -1) == []
        # ...mas continua rastreável na lista de processamento (não foi perdido).
        assert ingresso_id in r.lrange(ticket_email._REDIS_PROCESSING_KEY, 0, -1)

    def test_marcar_processado_remove_da_lista_processing(self, _redis_disponivel):
        r = _redis_disponivel
        ingresso_id = f"ing_{uuid.uuid4().hex[:8]}"
        r.lpush(ticket_email._REDIS_QUEUE_KEY, ingresso_id)
        ticket_email._dequeue_next()
        assert ingresso_id in r.lrange(ticket_email._REDIS_PROCESSING_KEY, 0, -1)

        ticket_email._marcar_processado(ingresso_id)

        assert ingresso_id not in r.lrange(ticket_email._REDIS_PROCESSING_KEY, 0, -1)

    def test_recupera_orfaos_de_processo_anterior_morto(self, _redis_disponivel):
        """Simula: um processo pegou o item (blmove) mas morreu antes de terminar
        de enviar — o item ficou preso em 'processing'. O próximo worker que subir
        precisa devolver isso pra fila principal, não deixar perdido."""
        r = _redis_disponivel
        orfao = f"ing_orfao_{uuid.uuid4().hex[:8]}"
        r.lpush(ticket_email._REDIS_PROCESSING_KEY, orfao)

        ticket_email._recuperar_orfaos_processing()

        assert orfao in r.lrange(ticket_email._REDIS_QUEUE_KEY, 0, -1)
        assert r.lrange(ticket_email._REDIS_PROCESSING_KEY, 0, -1) == []

    def test_worker_reinicia_se_thread_anterior_morreu(self, monkeypatch):
        """_worker_started sozinho não bastava — se a thread morresse (exceção não
        prevista), start_ticket_email_worker() nunca mais reiniciava (bug corrigido:
        agora também checa thread.is_alive())."""
        ticket_email._worker_started = True
        ticket_email._worker_thread = None  # simula thread morta/nunca setada

        ticket_email.start_ticket_email_worker()

        assert ticket_email._worker_thread is not None
        assert ticket_email._worker_thread.is_alive()
        ticket_email.stop_ticket_email_worker(aguardar_segundos=5)
        ticket_email._worker_thread.join(timeout=5)
        assert not ticket_email._worker_thread.is_alive()

    def test_enfileirar_e_processar_ponta_a_ponta_sem_smtp(self, monkeypatch, _redis_disponivel):
        """Sem SMTP configurado, _send_sync deve retornar True (conteúdo gerado,
        não enviado) e o worker deve consumir e limpar a fila normalmente."""
        monkeypatch.setattr(settings, "EMAIL_USER", "")
        monkeypatch.setattr(settings, "EMAIL_PASSWORD", "")
        # ingresso fake não existe no banco -> _send_sync sempre falha -> força só
        # 1 tentativa (sem isso o item cicla fila<->processing entre retries com
        # backoff crescente, e o teste ficaria não-determinístico/lento).
        monkeypatch.setattr(settings, "TICKET_EMAIL_MAX_ATTEMPTS", 1)

        r = _redis_disponivel
        fake_id = f"ing_{uuid.uuid4().hex[:8]}"
        # _send_sync busca o ingresso no banco; sem registro real, retorna False e
        # cai no fluxo de retry — o que já basta pra provar que o item não fica
        # preso em 'processing' ao final do ciclo.
        r.lpush(ticket_email._REDIS_QUEUE_KEY, fake_id)

        ticket_email.start_ticket_email_worker()
        for _ in range(30):
            if fake_id not in r.lrange(ticket_email._REDIS_PROCESSING_KEY, 0, -1):
                break
            time.sleep(0.2)
        else:
            pytest.fail("item ficou preso em 'processing' — não foi marcado como processado")

        ticket_email.stop_ticket_email_worker(aguardar_segundos=5)
        if ticket_email._worker_thread is not None:
            ticket_email._worker_thread.join(timeout=5)
