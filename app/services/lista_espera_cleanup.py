"""Job periódico: expira tokens de lista de espera e libera a fila."""

from __future__ import annotations

import logging
import threading
import time

from config.database import SessionLocal

logger = logging.getLogger(__name__)

_INTERVALO_SEGUNDOS = 300  # 5 minutos
_stop_event = threading.Event()
_thread: threading.Thread | None = None


def expirar_tokens_lista_espera() -> int:
    """Executa um ciclo de expiração. Retorna quantos tokens foram processados."""
    from app.services.lista_espera import expirar_tokens_vencidos

    db = SessionLocal()
    try:
        return expirar_tokens_vencidos(db)
    except Exception:
        db.rollback()
        logger.exception("Erro no ciclo de expiração da lista de espera")
        return 0
    finally:
        db.close()


def _worker() -> None:
    logger.info(
        "Worker de lista de espera iniciado (intervalo: %ds)", _INTERVALO_SEGUNDOS
    )
    while not _stop_event.is_set():
        try:
            n = expirar_tokens_lista_espera()
            if n > 0:
                logger.info("Lista de espera: %d token(s) expirado(s) / fila avançada", n)
        except Exception:
            logger.exception("Erro inesperado no worker de lista de espera")
        _stop_event.wait(_INTERVALO_SEGUNDOS)


def start_lista_espera_cleanup_worker() -> None:
    global _thread
    if _thread and _thread.is_alive():
        return
    _stop_event.clear()
    _thread = threading.Thread(
        target=_worker, name="lista-espera-cleanup-worker", daemon=True
    )
    _thread.start()


def stop_lista_espera_cleanup_worker() -> None:
    _stop_event.set()
    if _thread:
        _thread.join(timeout=10)
