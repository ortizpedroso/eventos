"""Lista de interesse (pré-venda) e notificação na abertura."""

from __future__ import annotations

import csv
import io
import logging
from datetime import datetime, timezone

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models import Evento, EventoListaInteresse
from app.services.notificacao_email import enqueue_email_simples
from app.utils.html_escape import assunto_email_seguro, esc

logger = logging.getLogger(__name__)


def inscrever_interesse(
    db: Session,
    evento: Evento,
    *,
    email: str,
    nome: str | None = None,
) -> EventoListaInteresse:
    email_norm = email.strip().lower()
    if not email_norm or "@" not in email_norm:
        raise HTTPException(status_code=400, detail="E-mail inválido.")

    existente = (
        db.query(EventoListaInteresse)
        .filter(EventoListaInteresse.evento_id == evento.id, EventoListaInteresse.email == email_norm)
        .first()
    )
    if existente:
        if nome and not existente.nome:
            existente.nome = nome.strip()[:120]
            db.commit()
        return existente

    row = EventoListaInteresse(evento_id=evento.id, email=email_norm, nome=(nome or "").strip()[:120] or None)
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


def exportar_interesse_csv(db: Session, evento_id: str) -> str:
    rows = (
        db.query(EventoListaInteresse)
        .filter(EventoListaInteresse.evento_id == evento_id)
        .order_by(EventoListaInteresse.data_criacao.asc())
        .all()
    )
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(["email", "nome", "data_criacao"])
    for r in rows:
        w.writerow([r.email, r.nome or "", r.data_criacao.isoformat() if r.data_criacao else ""])
    return buf.getvalue()


def notificar_abertura_vendas(db: Session, evento: Evento) -> int:
    """Envia e-mail aos inscritos quando vendas abrem (publicação ou lote elegível)."""
    from config.settings import settings

    inscritos = (
        db.query(EventoListaInteresse)
        .filter(EventoListaInteresse.evento_id == evento.id)
        .order_by(EventoListaInteresse.data_criacao.asc())
        .all()
    )
    if not inscritos:
        return 0

    base = (settings.FRONTEND_PUBLIC_URL or "http://localhost:3000").rstrip("/")
    link = f"{base}/eventos/{evento.slug}"
    nome = esc(evento.nome)
    assunto = f"Vendas abertas: {assunto_email_seguro(evento.nome)}"
    corpo = (
        f"<p>As vendas de ingressos para <strong>{nome}</strong> estão abertas!</p>"
        f'<p><a href="{link}">Comprar ingresso</a></p>'
    )
    enviados = 0
    for ins in inscritos:
        if enqueue_email_simples(ins.email, assunto, corpo):
            enviados += 1
    logger.info("Notificação abertura vendas evento %s: %s e-mails", evento.id, enviados)
    return enviados


def deve_notificar_abertura(
    evento: Evento,
    *,
    era_publicado: bool,
    tinha_venda_aberta: bool = False,
    tem_venda_aberta: bool = False,
) -> bool:
    """True na primeira publicação ou quando vendas passam a estar abertas (lote elegível)."""
    if not evento.aceita_interesse or not evento.publicado:
        return False
    if not era_publicado:
        return True
    return not tinha_venda_aberta and tem_venda_aberta
