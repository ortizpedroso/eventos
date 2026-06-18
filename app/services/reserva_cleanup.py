"""Job periódico: cancela reservas de ingressos pendentes que expiraram.

Camadas de proteção contra vagas fantasmas:
  1. Webhook Asaas (PAYMENT_OVERDUE / PAYMENT_DELETED) → cancela na hora
  2. Este job (a cada 5 min) → safety net para reservas sem cobrança ou webhook perdido
  3. Cancela a cobrança Asaas correspondente para evitar pagamentos tardios
"""

from __future__ import annotations

import logging
import threading
import time
from datetime import datetime, timezone

from config.database import SessionLocal
from config.settings import settings

logger = logging.getLogger(__name__)

_INTERVALO_SEGUNDOS = 300  # 5 minutos
_stop_event = threading.Event()
_thread: threading.Thread | None = None


def cancelar_reservas_expiradas() -> int:
    """Executa um ciclo de limpeza em sessão própria. Retorna o número cancelado."""
    from app.models import Ingresso  # import tardio para evitar circular

    agora = datetime.now(timezone.utc).replace(tzinfo=None)
    db = SessionLocal()
    try:
        expirados = (
            db.query(Ingresso)
            .filter(
                Ingresso.status == "pendente",
                Ingresso.reservado_ate.isnot(None),
                Ingresso.reservado_ate < agora,
            )
            .all()
        )

        pagamentos_ja_cancelados: set[str] = set()
        vagas_por_evento: dict[str, int] = {}
        for ing in expirados:
            ing.status = "cancelado"
            ing.reservado_ate = None
            vagas_por_evento[ing.evento_id] = vagas_por_evento.get(ing.evento_id, 0) + 1

            from app.services.lista_espera import expirar_espera_reserva_nao_concluida

            expirar_espera_reserva_nao_concluida(db, ing)

            pay_id = (ing.asaas_payment_id or "").strip()
            if (
                pay_id
                and pay_id not in pagamentos_ja_cancelados
                and not pay_id.startswith(("disabled_", "cortesia_"))
            ):
                try:
                    from app.services.pagamento_asaas import cancelar_cobranca_pendente

                    cancelar_cobranca_pendente(pay_id)
                    pagamentos_ja_cancelados.add(pay_id)
                except Exception:
                    logger.warning(
                        "Não foi possível cancelar cobrança Asaas %s do ingresso %s",
                        pay_id,
                        ing.id,
                        exc_info=True,
                    )

            logger.info("Reserva expirada cancelada: ingresso %s", ing.id)

        if expirados:
            db.commit()
            if vagas_por_evento:
                from app.services.lista_espera import liberar_vagas_apos_cancelamento

                for evento_id, qtd in vagas_por_evento.items():
                    liberar_vagas_apos_cancelamento(db, evento_id, qtd)

        return len(expirados)
    except Exception:
        db.rollback()
        logger.exception("Erro no ciclo de cleanup de reservas")
        return 0
    finally:
        db.close()


def _worker() -> None:
    logger.info(
        "Worker de cleanup de reservas iniciado (intervalo: %ds)", _INTERVALO_SEGUNDOS
    )
    while not _stop_event.is_set():
        try:
            n = cancelar_reservas_expiradas()
            if n > 0:
                logger.info("Cleanup: %d reserva(s) expirada(s) cancelada(s)", n)
        except Exception:
            logger.exception("Erro inesperado no worker de cleanup")
        _stop_event.wait(_INTERVALO_SEGUNDOS)


def start_reserva_cleanup_worker() -> None:
    global _thread
    if _thread and _thread.is_alive():
        return
    _stop_event.clear()
    _thread = threading.Thread(
        target=_worker, name="reserva-cleanup-worker", daemon=True
    )
    _thread.start()


def stop_reserva_cleanup_worker() -> None:
    _stop_event.set()
    if _thread:
        _thread.join(timeout=10)
