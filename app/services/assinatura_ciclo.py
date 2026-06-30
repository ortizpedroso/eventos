"""Ciclo automático de aviso e renovação da assinatura mensal (PIX)."""

from __future__ import annotations

import logging
import threading
from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from app.models import Usuario
from config.database import SessionLocal

logger = logging.getLogger(__name__)

_INTERVALO_SEGUNDOS = 3600
_AVISO_DIAS = 7
_RENOVACAO_DIAS = 3
_stop_event = threading.Event()
_thread: threading.Thread | None = None


def _agora() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _dias_ate(valida_ate: datetime, agora: datetime) -> int:
    return (valida_ate.date() - agora.date()).days


def _renovacao_ainda_pendente(db: Session, usuario: Usuario) -> bool:
    pay_id = (getattr(usuario, "assinatura_renovacao_payment_id", None) or "").strip()
    if not pay_id:
        return False
    if pay_id == (getattr(usuario, "assinatura_ultimo_payment_id", None) or "").strip():
        usuario.assinatura_renovacao_payment_id = None
        db.commit()
        return False

    from config.settings import settings as s

    if not s.use_asaas or s.ASAAS_DISABLED:
        return True

    try:
        from app.services.pagamento_asaas import obter_cobranca, status_eh_cancelado, status_eh_pago

        pay = obter_cobranca(pay_id)
        status = (pay.get("status") or "").upper()
        if status_eh_pago(status):
            from app.services.assinatura_organizador import processar_pagamento_assinatura_gateway

            processar_pagamento_assinatura_gateway(db, pay)
            return False
        if status_eh_cancelado(status) or status == "OVERDUE":
            usuario.assinatura_renovacao_payment_id = None
            db.commit()
            return False
        return True
    except Exception:
        logger.exception("Não foi possível consultar cobrança de renovação %s", pay_id)
        return True


def processar_ciclo_assinaturas(db: Session | None = None) -> dict[str, int]:
    """Aviso de expiração, geração automática de PIX de renovação e downgrade pós-expiração."""
    own_session = db is None
    if own_session:
        db = SessionLocal()
    assert db is not None
    try:
        return _processar_ciclo_assinaturas_db(db)
    except Exception:
        if own_session:
            db.rollback()
        logger.exception("Erro no ciclo de assinaturas")
        return {"avisos": 0, "renovacoes": 0, "expiradas": 0}
    finally:
        if own_session:
            db.close()


def _processar_ciclo_assinaturas_db(db: Session) -> dict[str, int]:
    from app.services.assinatura_email import (
        enviar_email_aviso_expiracao_assinatura,
        enviar_email_renovacao_assinatura_gerada,
    )
    from app.services.assinatura_organizador import cancelar_assinatura, iniciar_cobranca_assinatura

    agora = _agora()
    stats = {"avisos": 0, "renovacoes": 0, "expiradas": 0}

    candidatos = (
        db.query(Usuario)
        .filter(
            Usuario.tipo == "organizador",
            Usuario.ativo.is_(True),
            Usuario.assinatura_valida_ate.isnot(None),
        )
        .all()
    )
    for usuario in candidatos:
        valida_ate = usuario.assinatura_valida_ate
        if not valida_ate:
            continue

        dias = _dias_ate(valida_ate, agora)

        if dias < 0:
            if usuario.plano_tarifa == "assinatura":
                cancelar_assinatura(db, usuario)
                stats["expiradas"] += 1
            continue

        if dias <= _AVISO_DIAS:
            ultimo_aviso = getattr(usuario, "assinatura_aviso_expiracao_enviado_em", None)
            ciclo_inicio = valida_ate - timedelta(days=30)
            if ultimo_aviso is None or ultimo_aviso < ciclo_inicio:
                if enviar_email_aviso_expiracao_assinatura(
                    usuario, dias_restantes=dias, valida_ate=valida_ate
                ):
                    usuario.assinatura_aviso_expiracao_enviado_em = agora
                    stats["avisos"] += 1

        if dias <= _RENOVACAO_DIAS and usuario.plano_tarifa == "assinatura":
            if _renovacao_ainda_pendente(db, usuario):
                continue
            try:
                cobranca = iniciar_cobranca_assinatura(db, usuario)
            except ValueError:
                logger.warning("Renovação automática ignorada para %s", usuario.id)
                continue
            except Exception:
                logger.exception("Falha ao gerar renovação automática para %s", usuario.id)
                continue

            pay_id = (cobranca.get("payment_id") or "").strip()
            if pay_id and not cobranca.get("ja_pago"):
                usuario.assinatura_renovacao_payment_id = pay_id
                if enviar_email_renovacao_assinatura_gerada(usuario, payment_id=pay_id):
                    stats["renovacoes"] += 1
            elif cobranca.get("ja_pago"):
                usuario.assinatura_renovacao_payment_id = None
                stats["renovacoes"] += 1

    db.commit()
    return stats


def _worker() -> None:
    logger.info("Worker assinatura ciclo iniciado (intervalo: %ds)", _INTERVALO_SEGUNDOS)
    while not _stop_event.is_set():
        try:
            stats = processar_ciclo_assinaturas()
            if any(stats.values()):
                logger.info("Ciclo assinatura: %s", stats)
        except Exception:
            logger.exception("Erro inesperado no worker de assinatura")
        _stop_event.wait(_INTERVALO_SEGUNDOS)


def start_assinatura_ciclo_worker() -> None:
    global _thread
    if _thread and _thread.is_alive():
        return
    _stop_event.clear()
    _thread = threading.Thread(target=_worker, name="assinatura-ciclo-worker", daemon=True)
    _thread.start()


def stop_assinatura_ciclo_worker() -> None:
    _stop_event.set()
    if _thread:
        _thread.join(timeout=10)
