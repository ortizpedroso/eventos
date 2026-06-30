"""Worker: sincroniza status de repasse Asaas (subcontas pendentes).

Camadas de atualização do status de aprovação:
  1. Webhook Asaas (ACCOUNT_STATUS_*) → atualização imediata
  2. Este job (a cada 10 min) → poll GET /v3/myAccount/status para pendentes
  3. Poll na tela /organizador/financeiro/conta-repasse (20s) → UX em tempo quase real
"""

from __future__ import annotations

import logging
import threading
import time

from config.database import SessionLocal
from config.settings import settings

logger = logging.getLogger(__name__)

_INTERVALO_SEGUNDOS = 600  # 10 minutos
_stop_event = threading.Event()
_thread: threading.Thread | None = None


def sincronizar_ciclo_repasse() -> int:
    from app.services.organizador_asaas import sincronizar_repasses_pendentes

    if not settings.use_asaas or settings.payments_disabled:
        return 0
    db = SessionLocal()
    try:
        return sincronizar_repasses_pendentes(db)
    except Exception:
        logger.exception("Erro no ciclo de sync de repasse Asaas")
        db.rollback()
        return 0
    finally:
        db.close()


def _worker() -> None:
    logger.info("Worker de sync repasse Asaas iniciado (intervalo: %ds)", _INTERVALO_SEGUNDOS)
    while not _stop_event.is_set():
        try:
            n = sincronizar_ciclo_repasse()
            if n > 0:
                logger.info("Sync repasse: %d organizador(es) com status atualizado", n)
        except Exception:
            logger.exception("Erro inesperado no worker de sync repasse")
        _stop_event.wait(_INTERVALO_SEGUNDOS)


def start_repasse_status_sync_worker() -> None:
    global _thread
    if _thread and _thread.is_alive():
        return
    _stop_event.clear()
    _thread = threading.Thread(
        target=_worker,
        name="repasse-status-sync-worker",
        daemon=True,
    )
    _thread.start()


def stop_repasse_status_sync_worker() -> None:
    _stop_event.set()
    if _thread:
        _thread.join(timeout=10)
