"""Extrato, saldo e saques do organizador (white-label EventosBR)."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models import Evento, FinanceiroSaque, Ingresso, Usuario
from app.services.tarifas_plataforma import detalhar_taxa_ingresso, liquido_organizador, tarifa_para_organizador


def _ingressos_pagos_query(db: Session, organizador_id: str):
    return (
        db.query(Ingresso)
        .join(Evento, Ingresso.evento_id == Evento.id)
        .filter(
            Evento.organizador_id == organizador_id,
            Ingresso.status.in_(("pago", "usado")),
        )
    )


def calcular_saldo_organizador(db: Session, usuario: Usuario) -> dict[str, Any]:
    tarifa = tarifa_para_organizador(usuario)
    ingressos = _ingressos_pagos_query(db, usuario.id).all()
    bruto = round(sum(float(i.valor or 0) for i in ingressos), 2)
    liquido = round(sum(liquido_organizador(float(i.valor or 0), tarifa) for i in ingressos), 2)
    taxa_total = round(bruto - liquido, 2)

    saques_pagos = (
        db.query(func.coalesce(func.sum(FinanceiroSaque.valor), 0))
        .filter(
            FinanceiroSaque.organizador_id == usuario.id,
            FinanceiroSaque.status.in_(("pago", "processando", "pendente")),
        )
        .scalar()
    )
    saques_pagos_f = round(float(saques_pagos or 0), 2)
    disponivel = round(max(0.0, liquido - saques_pagos_f), 2)

    return {
        "plano_tarifa": tarifa.id,
        "rotulo_taxa": detalhar_taxa_ingresso(100, tarifa)["rotulo_taxa"],
        "receita_bruta": bruto,
        "taxa_plataforma_total": taxa_total,
        "liquido_acumulado": liquido,
        "saques_reservados": saques_pagos_f,
        "saldo_disponivel": disponivel,
        "ingressos_pagos": len(ingressos),
    }


def listar_extrato(
    db: Session,
    usuario: Usuario,
    *,
    limite: int = 50,
    offset: int = 0,
) -> dict[str, Any]:
    tarifa = tarifa_para_organizador(usuario)
    ingressos = (
        _ingressos_pagos_query(db, usuario.id)
        .order_by(Ingresso.data_compra.desc())
        .offset(offset)
        .limit(limite)
        .all()
    )
    evento_ids = {i.evento_id for i in ingressos}
    eventos = {e.id: e for e in db.query(Evento).filter(Evento.id.in_(evento_ids)).all()} if evento_ids else {}

    movimentos: list[dict[str, Any]] = []
    for ing in ingressos:
        val = float(ing.valor or 0)
        det = detalhar_taxa_ingresso(val, tarifa)
        ev = eventos.get(ing.evento_id)
        movimentos.append(
            {
                "tipo": "venda",
                "id": ing.id,
                "data": ing.data_compra.isoformat() if ing.data_compra else None,
                "evento_id": ing.evento_id,
                "evento_nome": ev.nome if ev else "",
                "valor_ingresso": val,
                "taxa_plataforma": det["taxa_total"],
                "liquido": det["liquido_organizador"],
                "descricao": f"Ingresso — {ev.nome if ev else 'evento'}",
            }
        )

    saques = (
        db.query(FinanceiroSaque)
        .filter(FinanceiroSaque.organizador_id == usuario.id)
        .order_by(FinanceiroSaque.criado_em.desc())
        .offset(offset)
        .limit(limite)
        .all()
    )
    for s in saques:
        movimentos.append(
            {
                "tipo": "saque",
                "id": s.id,
                "data": s.criado_em.isoformat() if s.criado_em else None,
                "valor": float(s.valor),
                "status": s.status,
                "pix_chave": s.pix_chave,
                "descricao": f"Solicitação de saque via Pix",
            }
        )

    movimentos.sort(key=lambda m: m.get("data") or "", reverse=True)
    return {
        "movimentos": movimentos[:limite],
        "saldo": calcular_saldo_organizador(db, usuario),
    }


def solicitar_saque(
    db: Session,
    usuario: Usuario,
    *,
    valor: float,
    pix_chave: str,
    pix_tipo: str = "EVP",
) -> FinanceiroSaque:
    if usuario.tipo != "organizador":
        raise ValueError("Apenas organizadores podem solicitar saque.")
    if not (usuario.asaas_wallet_id or "").strip():
        raise ValueError("Configure sua conta de repasses antes de solicitar saque.")

    valor_r = round(valor, 2)
    if valor_r < 1.0:
        raise ValueError("Valor mínimo para saque: R$ 1,00.")

    saldo = calcular_saldo_organizador(db, usuario)
    if valor_r > saldo["saldo_disponivel"]:
        raise ValueError(
            f"Saldo insuficiente. Disponível: R$ {saldo['saldo_disponivel']:.2f}."
        )

    chave = (pix_chave or "").strip()
    if len(chave) < 5:
        raise ValueError("Informe uma chave Pix válida.")

    agora = datetime.now(timezone.utc).replace(tzinfo=None)
    saque = FinanceiroSaque(
        organizador_id=usuario.id,
        valor=valor_r,
        pix_chave=chave,
        pix_tipo=(pix_tipo or "EVP").strip().upper()[:20],
        status="pendente",
        criado_em=agora,
        atualizado_em=agora,
    )
    db.add(saque)
    db.commit()
    db.refresh(saque)
    return saque
