"""Validação e aplicação de cupons de desconto por evento."""

from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.models import EventoCupom
from app.services.ingresso_lotes import agora_utc_naive


def normalizar_codigo_cupom(codigo: str) -> str:
    return (codigo or "").strip().upper()


def resolver_cupom_evento(db: Session, evento_id: str, codigo: str) -> EventoCupom:
    norm = normalizar_codigo_cupom(codigo)
    if len(norm) < 3:
        raise ValueError("Código de cupom inválido.")

    cupom = (
        db.query(EventoCupom)
        .filter(
            EventoCupom.evento_id == evento_id,
            EventoCupom.codigo == norm,
            EventoCupom.ativo.is_(True),
        )
        .first()
    )
    if not cupom:
        raise ValueError("Cupom não encontrado ou inativo.")

    agora = agora_utc_naive()
    if cupom.valido_ate is not None and cupom.valido_ate < agora:
        raise ValueError("Cupom expirado.")

    if cupom.max_usos is not None and int(cupom.usos or 0) >= int(cupom.max_usos):
        raise ValueError("Cupom esgotado (limite de usos atingido).")

    return cupom


def centavos_com_cupom(preco_centavos: int, cupom: EventoCupom) -> int:
    if preco_centavos <= 0:
        return 0
    tipo = (cupom.tipo or "").lower()
    if tipo == "percentual":
        pct = max(0.0, min(1.0, float(cupom.valor)))
        return max(50, int(round(preco_centavos * (1.0 - pct))))
    # fixo em reais
    desconto_centavos = int(round(float(cupom.valor) * 100))
    return max(50, preco_centavos - desconto_centavos)


def registrar_uso_cupom(db: Session, cupom_id: str | None) -> None:
    if not cupom_id:
        return
    cupom = db.get(EventoCupom, cupom_id)
    if cupom is not None:
        cupom.usos = int(cupom.usos or 0) + 1
