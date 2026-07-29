"""E-mail transacional simples (fila em memória / Redis).

Usado por onboarding, notificações de saque, lista de espera e lista de interesse.
"""

from __future__ import annotations

import logging
import threading
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from queue import Empty, Queue

from app.services.redis_conn import get_redis_optional
from app.services.smtp_client import format_from_header_branded, send_prebuilt_message, smtp_configured
from config.settings import settings

logger = logging.getLogger(__name__)

_REDIS_KEY = "eventosbr:q:email_simples"
_REDIS_PROCESSING_KEY = "eventosbr:q:email_simples:processing"
_memory: Queue[str] = Queue()
_worker_lock = threading.Lock()
_worker_started = False
_worker_thread: threading.Thread | None = None
_stop_worker = threading.Event()


def _payload(destino: str, assunto: str, html: str) -> str:
    # separador improvável em e-mails
    return f"{destino}\x1e{assunto}\x1e{html}"


def _parse(payload: str) -> tuple[str, str, str]:
    parts = payload.split("\x1e", 2)
    if len(parts) != 3:
        return "", "", ""
    return parts[0], parts[1], parts[2]


def _send_sync(destino: str, assunto: str, html: str) -> bool:
    if not smtp_configured():
        logger.info("E-mail simples (SMTP off): %s — %s", destino, assunto)
        return True
    try:
        msg = MIMEMultipart("alternative")
        msg["Subject"] = assunto
        msg["From"] = format_from_header_branded()
        msg["To"] = destino
        msg.attach(MIMEText(html, "html", "utf-8"))
        return send_prebuilt_message(msg, destino=destino)
    except Exception:
        logger.exception("Falha ao enviar e-mail simples para %s", destino)
        return False


def _use_redis_queue() -> bool:
    return bool(settings.TICKET_EMAIL_USE_REDIS and get_redis_optional())


def _dequeue_next() -> str | None:
    r = get_redis_optional()
    if _use_redis_queue() and r:
        try:
            # blmove (não blpop): move pra lista "processing" em vez de descartar —
            # se o worker morrer no meio do envio (deploy reiniciando o container),
            # o payload continua recuperável em vez de perdido pra sempre.
            #
            # BUG CORRIGIDO: a versão anterior usava blpop + .decode() no resultado,
            # mas o cliente Redis já usa decode_responses=True (retorna str, não
            # bytes) — .decode() numa str levanta AttributeError, capturada pelo
            # except genérico do loop e o payload era perdido silenciosamente em
            # TODA mensagem enfileirada via Redis (onboarding, saque, lista de
            # espera/interesse). Provavelmente a causa principal do "confirma que
            # foi enviado mas nunca chega".
            item = r.blmove(_REDIS_KEY, _REDIS_PROCESSING_KEY, timeout=5, src="RIGHT", dest="LEFT")
            if item:
                return item
            return None
        except Exception:
            logger.exception("Falha ao ler fila Redis de e-mail simples")
            return None
    try:
        return _memory.get(timeout=5)
    except Empty:
        return None


def _marcar_processado(payload: str) -> None:
    r = get_redis_optional()
    if _use_redis_queue() and r:
        try:
            r.lrem(_REDIS_PROCESSING_KEY, 1, payload)
        except Exception:
            logger.exception("Falha ao remover payload da lista de processamento (e-mail simples)")


def _recuperar_orfaos_processing() -> None:
    r = get_redis_optional()
    if not (_use_redis_queue() and r):
        return
    try:
        recuperados = 0
        while True:
            item = r.rpoplpush(_REDIS_PROCESSING_KEY, _REDIS_KEY)
            if item is None:
                break
            recuperados += 1
        if recuperados:
            logger.warning(
                "Worker de e-mail simples: %s mensagem(ns) órfã(s) recuperada(s) de um processo anterior",
                recuperados,
            )
    except Exception:
        logger.exception("Falha ao recuperar itens órfãos da fila de e-mail simples")


def _worker_loop() -> None:
    while not _stop_worker.is_set():
        payload = _dequeue_next()
        if not payload:
            continue
        try:
            destino, assunto, html = _parse(payload)
            if destino:
                _send_sync(destino, assunto, html)
        finally:
            _marcar_processado(payload)


def start_email_simples_worker() -> None:
    global _worker_started, _worker_thread
    with _worker_lock:
        if _worker_started and _worker_thread is not None and _worker_thread.is_alive():
            return
        _recuperar_orfaos_processing()
        _stop_worker.clear()
        t = threading.Thread(target=_worker_loop, name="email-simples", daemon=True)
        t.start()
        _worker_thread = t
        _worker_started = True


def stop_email_simples_worker(*, aguardar_segundos: float = 25.0) -> None:
    _stop_worker.set()
    if _worker_thread is not None and _worker_thread.is_alive():
        _worker_thread.join(timeout=aguardar_segundos)


def enqueue_email_simples(destino: str, assunto: str, html: str) -> bool:
    destino = destino.strip().lower()
    if not destino:
        return False
    start_email_simples_worker()
    payload = _payload(destino, assunto, html)
    r = get_redis_optional()
    if r and settings.TICKET_EMAIL_USE_REDIS:
        r.rpush(_REDIS_KEY, payload)
    else:
        _memory.put(payload)
    return True
