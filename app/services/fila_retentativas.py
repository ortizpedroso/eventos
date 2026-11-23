"""Novas tentativas de e-mail agendadas sem bloquear o worker.

O item que falhou espera num ZSET do Redis (ou num heap em memória) até vencer, e o
worker o devolve à fila na próxima volta do laço. Assim um e-mail com problema não
segura os que estão atrás dele, e a espera sobrevive a um reinício do container.
"""

from __future__ import annotations

import heapq
import logging
import threading
import time
from queue import Queue

logger = logging.getLogger(__name__)

_PROMOVER_VENCIDAS = """
local itens = redis.call('ZRANGEBYSCORE', KEYS[1], '-inf', ARGV[1], 'LIMIT', 0, 100)
for _, item in ipairs(itens) do
  redis.call('ZREM', KEYS[1], item)
  redis.call('LPUSH', KEYS[2], item)
end
return #itens
"""


def atraso_da_tentativa(tentativa: int) -> float:
    return float(min(tentativa * 2, 15))


class Retentativas:
    def __init__(self, fila_redis: str, fila_memoria: Queue[str]) -> None:
        self._fila_redis = fila_redis
        self._agendadas_redis = f"{fila_redis}:retry"
        self._fila_memoria = fila_memoria
        self._agendadas_memoria: list[tuple[float, str]] = []
        self._lock = threading.Lock()

    def agendar_redis(self, r, item: str, atraso: float) -> None:
        r.zadd(self._agendadas_redis, {item: time.time() + atraso})

    def agendar_memoria(self, item: str, atraso: float) -> None:
        with self._lock:
            heapq.heappush(self._agendadas_memoria, (time.monotonic() + atraso, item))

    def promover_vencidas(self, r) -> None:
        if r is not None:
            try:
                r.eval(_PROMOVER_VENCIDAS, 2, self._agendadas_redis, self._fila_redis, time.time())
            except Exception:
                logger.exception("Falha ao devolver novas tentativas vencidas para %s", self._fila_redis)
        agora = time.monotonic()
        with self._lock:
            while self._agendadas_memoria and self._agendadas_memoria[0][0] <= agora:
                self._fila_memoria.put(heapq.heappop(self._agendadas_memoria)[1])
