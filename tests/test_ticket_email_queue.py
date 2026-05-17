"""Fila de e-mail de ingressos (Redis ou memória)."""

from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest

from app.services import ticket_email
from app.services.redis_conn import reset_redis_client_for_tests
from config.settings import settings


@pytest.fixture(autouse=True)
def _reset_redis():
    reset_redis_client_for_tests()
    yield
    reset_redis_client_for_tests()


def test_enqueue_usa_memoria_sem_redis(monkeypatch):
    monkeypatch.setattr(settings, "TICKET_EMAIL_USE_REDIS", True)
    monkeypatch.setattr(ticket_email, "get_redis_optional", lambda: None)
    ticket_email._memory_queue.queue.clear()

    with patch.object(ticket_email, "start_ticket_email_worker"):
        ticket_email.enqueue_ticket_email("ing-test-1")

    assert list(ticket_email._memory_queue.queue) == ["ing-test-1"]


def test_enqueue_usa_redis_quando_disponivel(monkeypatch):
    mock_redis = MagicMock()
    monkeypatch.setattr(settings, "TICKET_EMAIL_USE_REDIS", True)
    monkeypatch.setattr(ticket_email, "get_redis_optional", lambda: mock_redis)

    with patch.object(ticket_email, "start_ticket_email_worker"):
        ticket_email.enqueue_ticket_email("ing-test-2")

    mock_redis.lpush.assert_called_once_with(ticket_email._REDIS_QUEUE_KEY, "ing-test-2")


def test_retry_reenfileira_no_redis(monkeypatch):
    mock_redis = MagicMock()
    mock_redis.incr.return_value = 1
    monkeypatch.setattr(settings, "TICKET_EMAIL_MAX_ATTEMPTS", 3)
    monkeypatch.setattr(ticket_email, "get_redis_optional", lambda: mock_redis)
    monkeypatch.setattr(ticket_email, "_use_redis_queue", lambda: True)

    with patch("time.sleep"):
        ticket_email._schedule_retry("ing-retry")

    mock_redis.lpush.assert_called_once()
