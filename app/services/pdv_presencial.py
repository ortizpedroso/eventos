"""Venda presencial (PDV) — registro manual sem Asaas/split."""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from app.models import Evento, EventoIngressoLote, Ingresso, Usuario
from app.services.lote_assentos import reservar_vaga_e_assento
from app.services.ticket_email import enqueue_ticket_email
from app.utils.ingresso_tipos import lote_e_cortesia

FORMAS_PAGAMENTO_PDV = frozenset({"dinheiro", "pix_manual", "cartao"})


def vender_ingresso_pdv(
    db: Session,
    *,
    evento: Evento,
    organizador: Usuario,
    lote_id: str,
    participante_nome: str,
    participante_email: str | None = None,
    participante_telefone: str | None = None,
    forma_pagamento: str,
    assento: str | None = None,
) -> Ingresso:
    nome = (participante_nome or "").strip()
    if not nome:
        raise ValueError("Informe o nome do participante.")
    if len(nome) > 200:
        raise ValueError("Nome do participante é longo demais.")

    forma = (forma_pagamento or "").strip().lower()
    if forma not in FORMAS_PAGAMENTO_PDV:
        raise ValueError("Forma de pagamento inválida. Use: dinheiro, pix_manual ou cartao.")

    email = (participante_email or "").strip() or None
    telefone = (participante_telefone or "").strip() or None
    if email and len(email) > 255:
        raise ValueError("E-mail inválido.")
    if telefone and len(telefone) > 20:
        raise ValueError("Telefone inválido.")

    lote_chk = db.get(EventoIngressoLote, lote_id)
    if lote_chk is None or lote_chk.evento_id != evento.id:
        raise ValueError("Lote não pertence a este evento.")

    lote, assento_codigo = reservar_vaga_e_assento(
        db, lote_id, quantidade=1, assento=assento
    )

    agora = datetime.now(timezone.utc).replace(tzinfo=None)
    unit = 0.0 if lote_e_cortesia(getattr(lote, "tipo", None)) else float(lote.preco or 0)
    ingresso = Ingresso(
        evento_id=evento.id,
        usuario_id=organizador.id,
        lote_id=lote.id,
        assento=assento_codigo,
        canal_venda="pdv",
        forma_pagamento_pdv=forma,
        participante_nome=nome,
        participante_email=email,
        participante_telefone=telefone,
        valor=unit,
        valor_cobrado=unit,
        liquido_repassado=unit,
        taxa_plataforma_aplicada=0.0,
        asaas_payment_id=f"pdv_{uuid.uuid4().hex}",
        status="pago",
        pago_em=agora,
        data_compra=agora,
        data_limite_cancelamento=agora + timedelta(days=10),
    )
    db.add(ingresso)
    db.commit()
    db.refresh(ingresso)

    if email:
        enqueue_ticket_email(ingresso.id)

    return ingresso
