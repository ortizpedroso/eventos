"""Um e-mail que falha não pode segurar os outros da fila enquanto espera a nova tentativa."""

from __future__ import annotations

import threading
import time

import pytest

from app.services import contato_email, notificacao_email, ticket_email
from app.services.redis_conn import get_redis_optional, reset_redis_client_for_tests
from config.settings import settings
from tests.fila_email_helpers import REDIS_URL_FILA_TESTES, parar_workers_email

PRAZO_DO_EMAIL_BOM = 1.5
PRAZO_DA_NOVA_TENTATIVA = 12.0


class _Registro:
    def __init__(self) -> None:
        self.chamadas: list[tuple[str, float]] = []
        self.inicio = time.monotonic()
        self._lock = threading.Lock()

    def anotar(self, item: str) -> None:
        with self._lock:
            self.chamadas.append((item, time.monotonic() - self.inicio))

    def primeira(self, item: str) -> float | None:
        return next((t for i, t in self.chamadas if i == item), None)

    def quantas(self, item: str) -> int:
        return sum(1 for i, _ in self.chamadas if i == item)


def _esperar(condicao, prazo: float) -> bool:
    limite = time.monotonic() + prazo
    while time.monotonic() < limite:
        if condicao():
            return True
        time.sleep(0.05)
    return condicao()


def _fila_ticket(monkeypatch, reg):
    monkeypatch.setattr(ticket_email, "_send_sync", lambda item: (reg.anotar(item), item != "falha")[1])
    return ticket_email, ticket_email._REDIS_QUEUE_KEY, ticket_email.start_ticket_email_worker, "falha", "ok"


def _fila_contato(monkeypatch, reg):
    monkeypatch.setattr(contato_email, "_send_sync", lambda item: (reg.anotar(item), item != "falha")[1])
    return contato_email, contato_email._REDIS_QUEUE_KEY, contato_email.start_contato_email_worker, "falha", "ok"


def _fila_simples(monkeypatch, reg):
    monkeypatch.setattr(
        notificacao_email, "_send_sync", lambda destino, _a, _h: (reg.anotar(destino), destino != "falha@x.com")[1]
    )
    return (
        notificacao_email,
        notificacao_email._REDIS_KEY,
        notificacao_email.start_email_simples_worker,
        notificacao_email._payload("falha@x.com", "a", "h"),
        notificacao_email._payload("ok@x.com", "a", "h"),
    )


FILAS = {"ingresso": _fila_ticket, "contato": _fila_contato, "simples": _fila_simples}


@pytest.fixture
def redis_limpo(monkeypatch):
    parar_workers_email()
    monkeypatch.setattr(settings, "REDIS_URL", REDIS_URL_FILA_TESTES)
    monkeypatch.setattr(settings, "ENVIRONMENT", "development")
    monkeypatch.setattr(settings, "TICKET_EMAIL_USE_REDIS", True)
    monkeypatch.setattr(settings, "TICKET_EMAIL_MAX_ATTEMPTS", 3)
    reset_redis_client_for_tests()
    r = get_redis_optional()
    assert r is not None, "Redis precisa estar disponível para estes testes"
    r.flushdb()
    yield r
    parar_workers_email()
    r.flushdb()
    reset_redis_client_for_tests()


@pytest.mark.parametrize("fila", sorted(FILAS))
def test_email_com_falha_nao_atrasa_o_seguinte(fila, monkeypatch, redis_limpo):
    reg = _Registro()
    _modulo, chave, iniciar, item_falha, item_ok = FILAS[fila](monkeypatch, reg)
    destino_falha = "falha@x.com" if fila == "simples" else item_falha
    destino_ok = "ok@x.com" if fila == "simples" else item_ok

    redis_limpo.lpush(chave, item_falha)
    redis_limpo.lpush(chave, item_ok)
    reg.inicio = time.monotonic()
    iniciar()

    assert _esperar(lambda: reg.primeira(destino_ok) is not None, 5.0), "e-mail bom nunca foi enviado"
    assert reg.primeira(destino_falha) < reg.primeira(destino_ok), "ordem FIFO preservada"
    assert reg.primeira(destino_ok) < PRAZO_DO_EMAIL_BOM, (
        f"e-mail bom esperou {reg.primeira(destino_ok):.1f}s atrás do que falhou"
    )
    assert _esperar(lambda: reg.quantas(destino_falha) >= 2, PRAZO_DA_NOVA_TENTATIVA), (
        "o e-mail que falhou precisa ganhar nova tentativa"
    )


@pytest.mark.parametrize("fila", sorted(FILAS))
def test_erro_inesperado_no_envio_nao_derruba_o_worker_nem_perde_o_email(fila, monkeypatch, redis_limpo):
    reg = _Registro()
    modulo, chave, iniciar, item_falha, _item_ok = FILAS[fila](monkeypatch, reg)
    destino = "falha@x.com" if fila == "simples" else item_falha

    def explode_na_primeira(*args):
        if reg.quantas(destino) == 0:
            reg.anotar(destino)
            raise RuntimeError("erro inesperado no envio")
        reg.anotar(destino)
        return True

    monkeypatch.setattr(modulo, "_send_sync", explode_na_primeira)
    redis_limpo.lpush(chave, item_falha)
    iniciar()

    assert _esperar(lambda: reg.quantas(destino) >= 2, PRAZO_DA_NOVA_TENTATIVA), "e-mail perdido após erro inesperado"
    assert modulo._worker_thread is not None and modulo._worker_thread.is_alive(), "worker morreu com o erro"
