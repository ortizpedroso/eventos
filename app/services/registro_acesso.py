"""Registro de IP e horário de uso da aplicação (Marco Civil da Internet, art. 15).

Guardado por pelo menos 6 meses. Falha ao gravar nunca impede o login ou a ação do usuário.
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from typing import Literal

from fastapi import Request
from sqlalchemy.orm import Session

from app.deps.rate_limit import client_ip_from_request
from app.models import RegistroAcesso

logger = logging.getLogger(__name__)

AcaoAcesso = Literal["cadastro", "login", "evento_criado", "evento_publicado"]

RETENCAO = timedelta(days=190)
_INTERVALO_LIMPEZA = timedelta(days=1)
_ultima_limpeza: datetime | None = None


def _agora() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def apagar_registros_antigos(db: Session, agora: datetime | None = None) -> int:
    limite = (agora or _agora()) - RETENCAO
    return db.query(RegistroAcesso).filter(RegistroAcesso.criado_em < limite).delete(synchronize_session=False)


def registrar_acesso(
    db: Session,
    request: Request,
    acao: AcaoAcesso,
    *,
    usuario_id: str | None,
    referencia: str | None = None,
) -> None:
    global _ultima_limpeza
    # Sessão própria: o registro não interfere na transação da rota que o chamou.
    sessao = Session(bind=db.get_bind())
    try:
        sessao.add(
            RegistroAcesso(
                acao=acao,
                usuario_id=usuario_id,
                referencia=referencia,
                ip=client_ip_from_request(request)[:64],
                user_agent=(request.headers.get("user-agent") or "")[:300] or None,
            )
        )
        agora = _agora()
        if _ultima_limpeza is None or agora - _ultima_limpeza >= _INTERVALO_LIMPEZA:
            apagar_registros_antigos(sessao, agora)
            _ultima_limpeza = agora
        sessao.commit()
    except Exception:
        sessao.rollback()
        logger.exception("Falha ao gravar registro de acesso (%s)", acao)
    finally:
        sessao.close()
