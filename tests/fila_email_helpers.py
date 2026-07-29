"""Helpers compartilhados pelos testes de fila confiável de e-mail.

Os testes de fila monkeypatcham ENVIRONMENT=development e REDIS_URL para poder
falar com Redis de verdade. Sem isolar/parar workers, qualquer thread de worker
ainda viva (ex.: iniciada por enqueue_* em outro teste) passa a consumir as
mesmas chaves Redis via blmove e compete com _dequeue_next() sob teste.
"""

from __future__ import annotations

from app.services import contato_email, notificacao_email, ticket_email

# DB dedicado — evita colidir com lixo residual em db/0 de sessões anteriores.
REDIS_URL_FILA_TESTES = "redis://localhost:6379/15"


def parar_workers_email() -> None:
    """Para os três workers de e-mail e zera flags para o próximo start_* limpo."""
    ticket_email.stop_ticket_email_worker(aguardar_segundos=5)
    if ticket_email._worker_thread is not None:
        ticket_email._worker_thread.join(timeout=5)
    ticket_email._worker_started = False
    ticket_email._worker_thread = None
    ticket_email._stop_worker.set()

    notificacao_email.stop_email_simples_worker(aguardar_segundos=5)
    if notificacao_email._worker_thread is not None:
        notificacao_email._worker_thread.join(timeout=5)
    notificacao_email._worker_started = False
    notificacao_email._worker_thread = None
    notificacao_email._stop_worker.set()

    contato_email.stop_contato_email_worker(aguardar_segundos=5)
    if contato_email._worker_thread is not None:
        contato_email._worker_thread.join(timeout=5)
    contato_email._worker_started = False
    contato_email._worker_thread = None
    contato_email._stop_worker.set()
