"""Envio assíncrono do e-mail do formulário público 'Fale conosco'.

Mesmo padrão de fila confiável de app/services/ticket_email.py: blmove (não
brpop/blpop) pra uma lista 'processing', recuperação de órfãos se o processo
morrer no meio do envio, e o worker reinicia sozinho se a thread cair.

Antes, o envio acontecia de forma SÍNCRONA dentro da própria requisição HTTP
(routes/public.py chamava smtp_client.send_email diretamente) — se o SMTP
demorasse ou falhasse (até ~30s por modo, 3 modos de fallback = até ~90s), a
tela do formulário ficava travada esperando. Agora a rota só enfileira (volta
na hora) e esse worker processa em segundo plano.
"""

from __future__ import annotations

import logging
import threading
from queue import Empty, Queue

from app.services.redis_conn import get_redis_optional
from config.settings import settings

logger = logging.getLogger(__name__)

_REDIS_QUEUE_KEY = "eventosbr:q:contato_email"
_REDIS_PROCESSING_KEY = "eventosbr:q:contato_email:processing"

_memory_queue: Queue[str] = Queue()
_worker_lock = threading.Lock()
_worker_started = False
_worker_thread: threading.Thread | None = None
_stop_worker = threading.Event()


def _use_redis_queue() -> bool:
    return bool(settings.TICKET_EMAIL_USE_REDIS and get_redis_optional())


def _send_sync(mensagem_id: str) -> bool:
    from app.models import get_db
    from app.models.contato_site_mensagem import ContatoSiteMensagem
    from app.services.platform_settings import get_public_settings
    from app.services.smtp_client import send_email, smtp_configured

    db = next(get_db())
    try:
        registro = db.get(ContatoSiteMensagem, mensagem_id)
        if not registro:
            logger.error("Contato %s não encontrado para envio", mensagem_id)
            return True  # não faz sentido tentar de novo — registro sumiu

        settings_pub = get_public_settings(db)
        destino = settings_pub.contact_email or settings_pub.support_email
        if not destino or not smtp_configured():
            logger.error(
                "Contato %s sem destino/SMTP configurado (destino=%s, smtp=%s)",
                mensagem_id, destino, smtp_configured(),
            )
            return False

        corpo = (
            f"Nova mensagem pelo formulário de contato do site.\n\n"
            f"Nome: {registro.nome}\n"
            f"E-mail: {registro.email}\n"
            f"Assunto: {registro.assunto}\n\n"
            f"Mensagem:\n{registro.mensagem}\n"
        )
        ok = send_email(
            destino=destino,
            assunto=f"[Contato site] {registro.assunto}",
            corpo_texto=corpo,
            reply_to=registro.email,
            db=db,
        )
        if ok:
            registro.email_enviado = True
            db.commit()
        else:
            logger.error("Falha ao enviar e-mail do contato %s para %s", mensagem_id, destino)
        return ok
    except Exception:
        logger.exception("Erro processando contato %s", mensagem_id)
        db.rollback()
        return False
    finally:
        db.close()


def _dequeue_next() -> str | None:
    r = get_redis_optional()
    if _use_redis_queue() and r:
        try:
            item = r.blmove(_REDIS_QUEUE_KEY, _REDIS_PROCESSING_KEY, timeout=2, src="RIGHT", dest="LEFT")
            if item:
                return item
        except Exception:
            logger.exception("Falha ao ler fila Redis de e-mail de contato")
        return None
    try:
        return _memory_queue.get(timeout=0.5)
    except Empty:
        return None


def _marcar_processado(mensagem_id: str) -> None:
    r = get_redis_optional()
    if _use_redis_queue() and r:
        try:
            r.lrem(_REDIS_PROCESSING_KEY, 1, mensagem_id)
        except Exception:
            logger.exception("Falha ao remover %s da lista de processamento (contato)", mensagem_id)


def _recuperar_orfaos_processing() -> None:
    r = get_redis_optional()
    if not (_use_redis_queue() and r):
        return
    try:
        recuperados = 0
        while True:
            item = r.rpoplpush(_REDIS_PROCESSING_KEY, _REDIS_QUEUE_KEY)
            if item is None:
                break
            recuperados += 1
        if recuperados:
            logger.warning("Worker de e-mail de contato: %s mensagem(ns) órfã(s) recuperada(s)", recuperados)
    except Exception:
        logger.exception("Falha ao recuperar órfãos da fila de e-mail de contato")


def _worker_loop() -> None:
    while not _stop_worker.is_set():
        mensagem_id = _dequeue_next()
        if not mensagem_id:
            continue
        try:
            _send_sync(mensagem_id)
        finally:
            _marcar_processado(mensagem_id)


def start_contato_email_worker() -> None:
    global _worker_started, _worker_thread
    with _worker_lock:
        if _worker_started and _worker_thread is not None and _worker_thread.is_alive():
            return
        _recuperar_orfaos_processing()
        _stop_worker.clear()
        t = threading.Thread(target=_worker_loop, name="contato-email-worker", daemon=True)
        t.start()
        _worker_thread = t
        _worker_started = True


def stop_contato_email_worker(*, aguardar_segundos: float = 25.0) -> None:
    _stop_worker.set()
    if _worker_thread is not None and _worker_thread.is_alive():
        _worker_thread.join(timeout=aguardar_segundos)


def enqueue_contato_email(mensagem_id: str) -> None:
    start_contato_email_worker()
    r = get_redis_optional()
    if r and settings.TICKET_EMAIL_USE_REDIS:
        r.rpush(_REDIS_QUEUE_KEY, mensagem_id)
    else:
        _memory_queue.put(mensagem_id)
