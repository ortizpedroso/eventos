"""Galeria de edições anteriores (fotos reais enviadas pelo organizador)."""

from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.models import Evento, EventoGaleriaFoto
from app.utils.imagem_url import validar_imagem_url

GALERIA_MAX = 6


def _agora() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def listar_urls(db: Session, evento_id: str) -> list[str]:
    rows = (
        db.query(EventoGaleriaFoto)
        .filter(EventoGaleriaFoto.evento_id == evento_id)
        .order_by(EventoGaleriaFoto.ordem.asc(), EventoGaleriaFoto.criado_em.asc())
        .all()
    )
    return [r.url for r in rows if r.url]


def substituir_galeria(db: Session, evento: Evento, urls: list[str] | None) -> list[str]:
    """Substitui a galeria do evento. `None` = não altera; `[]` = limpa."""
    if urls is None:
        return listar_urls(db, evento.id)

    limpas: list[str] = []
    for u in urls:
        try:
            v = validar_imagem_url(u)
        except Exception as e:
            raise ValueError(str(e)) from e
        if v:
            limpas.append(v)
    if len(limpas) > GALERIA_MAX:
        raise ValueError(f"Máximo de {GALERIA_MAX} fotos na galeria")

    db.query(EventoGaleriaFoto).filter(EventoGaleriaFoto.evento_id == evento.id).delete()
    for i, url in enumerate(limpas):
        db.add(
            EventoGaleriaFoto(
                evento_id=evento.id,
                url=url,
                ordem=i,
                criado_em=_agora(),
            )
        )
    db.flush()
    return limpas
