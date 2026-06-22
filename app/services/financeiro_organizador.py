"""Extrato, saldo e saques do organizador (white-label EventosBR)."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from sqlalchemy import func, literal, union_all
from sqlalchemy.orm import Session

from app.models import Evento, FinanceiroSaque, Ingresso, Usuario
from app.services.tarifas_plataforma import (
    detalhar_taxa_ingresso,
    liquido_ingresso_para_saldo,
    tarifa_para_organizador,
    taxa_ingresso,
)

_SAQUES_RESERVAM_SALDO = ("pendente", "processando", "pago")
_SAQUES_NAO_RESERVAM = ("cancelado", "rejeitado")


def _ingressos_pagos_query(db: Session, organizador_id: str):
    return (
        db.query(Ingresso)
        .join(Evento, Ingresso.evento_id == Evento.id)
        .filter(
            Evento.organizador_id == organizador_id,
            Ingresso.status.in_(("pago", "usado")),
        )
    )


def _backfill_ledger_pendentes(db: Session, organizador_id: str, *, limit: int = 100) -> None:
    """Preenche ledger em ingressos pagos antigos (uma vez por consulta)."""
    from app.services.ingresso_pago import _garantir_ledger_ingresso

    pendentes = (
        _ingressos_pagos_query(db, organizador_id)
        .filter(Ingresso.liquido_repassado.is_(None))
        .limit(limit)
        .all()
    )
    if not pendentes:
        return
    for ing in pendentes:
        _garantir_ledger_ingresso(db, ing)
    db.commit()


def calcular_saldo_organizador(db: Session, usuario: Usuario) -> dict[str, Any]:
    _backfill_ledger_pendentes(db, usuario.id)
    tarifa = tarifa_para_organizador(usuario)
    ingressos = _ingressos_pagos_query(db, usuario.id).all()
    bruto = round(sum(float(i.valor or 0) for i in ingressos), 2)
    liquido = round(sum(liquido_ingresso_para_saldo(i, tarifa) for i in ingressos), 2)
    taxa_total = round(
        sum(
            float(i.taxa_plataforma_aplicada)
            if getattr(i, "taxa_plataforma_aplicada", None) is not None
            else taxa_ingresso(float(i.valor or 0), tarifa)
            for i in ingressos
        ),
        2,
    )

    saques_pagos = (
        db.query(func.coalesce(func.sum(FinanceiroSaque.valor), 0))
        .filter(
            FinanceiroSaque.organizador_id == usuario.id,
            FinanceiroSaque.status.in_(_SAQUES_RESERVAM_SALDO),
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
        "total_repassado_split": liquido,
        "saques_reservados": saques_pagos_f,
        "saldo_disponivel": disponivel,
        "saque_habilitado": False,
        "nota_saque": (
            "Os valores das vendas são repassados automaticamente para sua conta de repasses "
            "no momento de cada pagamento (split). Não é necessário solicitar saque pela plataforma."
        ),
        "ingressos_pagos": len(ingressos),
    }


def _movimento_venda(ingresso: Ingresso, evento: Evento | None, tarifa) -> dict[str, Any]:
    val = float(ingresso.valor or 0)
    liquido = liquido_ingresso_para_saldo(ingresso, tarifa)
    taxa = round(val - liquido, 2)
    if getattr(ingresso, "taxa_plataforma_aplicada", None) is not None:
        taxa = float(ingresso.taxa_plataforma_aplicada)
    return {
        "tipo": "venda",
        "id": ingresso.id,
        "data": ingresso.data_compra.isoformat() if ingresso.data_compra else None,
        "evento_id": ingresso.evento_id,
        "evento_nome": evento.nome if evento else "",
        "valor_ingresso": val,
        "taxa_plataforma": taxa,
        "liquido": liquido,
        "descricao": f"Ingresso — {evento.nome if evento else 'evento'}",
    }


def _movimento_saque(saque: FinanceiroSaque) -> dict[str, Any]:
    return {
        "tipo": "saque",
        "id": saque.id,
        "data": saque.criado_em.isoformat() if saque.criado_em else None,
        "valor": float(saque.valor),
        "status": saque.status,
        "pix_chave": saque.pix_chave,
        "descricao": "Solicitação de saque via Pix",
    }


def listar_extrato(
    db: Session,
    usuario: Usuario,
    *,
    limite: int = 50,
    offset: int = 0,
) -> dict[str, Any]:
    _backfill_ledger_pendentes(db, usuario.id)
    tarifa = tarifa_para_organizador(usuario)

    saques_q = db.query(FinanceiroSaque).filter(FinanceiroSaque.organizador_id == usuario.id)
    total_saques = saques_q.count()
    total_vendas = _ingressos_pagos_query(db, usuario.id).count()
    total_movimentos = total_vendas + total_saques

    vendas_rows = (
        db.query(
            literal("venda").label("tipo"),
            Ingresso.id.label("rid"),
            Ingresso.data_compra.label("dt"),
        )
        .join(Evento, Ingresso.evento_id == Evento.id)
        .filter(
            Evento.organizador_id == usuario.id,
            Ingresso.status.in_(("pago", "usado")),
        )
    )
    saques_rows = saques_q.with_entities(
        literal("saque").label("tipo"),
        FinanceiroSaque.id.label("rid"),
        FinanceiroSaque.criado_em.label("dt"),
    )
    union_sub = union_all(vendas_rows.statement, saques_rows.statement).alias("mov")
    page = (
        db.query(union_sub.c.tipo, union_sub.c.rid, union_sub.c.dt)
        .order_by(union_sub.c.dt.desc())
        .offset(offset)
        .limit(limite)
        .all()
    )

    venda_ids = [rid for tipo, rid, _ in page if tipo == "venda"]
    saque_ids = {rid for tipo, rid, _ in page if tipo == "saque"}

    ingressos_map: dict[str, Ingresso] = {}
    if venda_ids:
        for ing in db.query(Ingresso).filter(Ingresso.id.in_(venda_ids)).all():
            ingressos_map[ing.id] = ing
    evento_ids = {i.evento_id for i in ingressos_map.values()}
    eventos = {e.id: e for e in db.query(Evento).filter(Evento.id.in_(evento_ids)).all()} if evento_ids else {}
    saques_map = {s.id: s for s in saques_q.filter(FinanceiroSaque.id.in_(saque_ids)).all()} if saque_ids else {}

    movimentos: list[dict[str, Any]] = []
    for tipo, rid, _ in page:
        if tipo == "venda":
            ing = ingressos_map.get(rid)
            if ing:
                movimentos.append(_movimento_venda(ing, eventos.get(ing.evento_id), tarifa))
        else:
            saq = saques_map.get(rid)
            if saq:
                movimentos.append(_movimento_saque(saq))

    return {
        "movimentos": movimentos,
        "total_movimentos": total_movimentos,
        "offset": offset,
        "limite": limite,
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
    raise ValueError(
        "Os repasses são automáticos no momento da venda (split). "
        "O valor líquido já vai para sua conta de repasses — não é necessário solicitar saque pela plataforma."
    )


def cancelar_saque(db: Session, usuario: Usuario, saque_id: str) -> FinanceiroSaque:
    if usuario.tipo != "organizador":
        raise ValueError("Apenas organizadores podem cancelar saques.")
    saque = (
        db.query(FinanceiroSaque)
        .filter(
            FinanceiroSaque.id == saque_id,
            FinanceiroSaque.organizador_id == usuario.id,
        )
        .with_for_update()
        .first()
    )
    if not saque:
        raise ValueError("Saque não encontrado.")
    if saque.status != "pendente":
        raise ValueError("Só é possível cancelar saques pendentes.")
    saque.status = "cancelado"
    saque.atualizado_em = datetime.now(timezone.utc).replace(tzinfo=None)
    db.commit()
    db.refresh(saque)
    return saque


def registrar_ledger_ingressos_lote(
    ingressos: list[Ingresso],
    *,
    tarifa,
    desconto_parcelamento_total: float = 0.0,
    parcelas: int | None = None,
) -> None:
    """Persiste valores de repasse por ingresso (split Asaas)."""
    from app.services.tarifas_plataforma import ledger_ingresso_venda

    q = max(1, len(ingressos))
    for ing in ingressos:
        ledger = ledger_ingresso_venda(
            float(ing.valor or 0),
            tarifa=tarifa,
            desconto_parcelamento_total=desconto_parcelamento_total,
            quantidade_lote=q,
            parcelas=parcelas,
        )
        ing.liquido_repassado = ledger["liquido_repassado"]
        ing.taxa_plataforma_aplicada = ledger["taxa_plataforma_aplicada"]
        ing.desconto_parcelamento_organizador = ledger["desconto_parcelamento_organizador"]
        ing.parcelas_cobranca = ledger["parcelas_cobranca"]
        ing.plano_tarifa_venda = ledger["plano_tarifa_venda"]
