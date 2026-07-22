"""Extrato, saldo, saques e relatórios do organizador (white-label EventosBR)."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any, Literal

from sqlalchemy import func, literal, union_all
from sqlalchemy.orm import Session

from app.models import Evento, FinanceiroSaque, Ingresso, Usuario
from app.services.evento_repasse import organizador_repasse_aprovado
from app.services.saque_asaas import (
    comprovante_saque,
    consultar_saldo_subconta,
    criar_transferencia_pix,
    inferir_pix_tipo,
    normalizar_pix_chave,
    organizador_tem_cliente_saque,
    previsao_liquidacao_saque,
    validar_pix_cadastro_repasse,
)
from app.services.tarifas_plataforma import (
    detalhar_taxa_ingresso,
    liquido_ingresso_para_saldo,
    tarifa_para_organizador,
    taxa_ingresso,
)
from config.settings import settings

_SAQUES_COMPROMETEM_SALDO = ("pendente", "processando", "pago")
_SAQUES_NAO_COMPROMETEM = ("cancelado", "rejeitado")

AgrupamentoVendas = Literal["dia", "semana", "mes", "ano", "evento"]


def _agora() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _carencia() -> timedelta:
    return timedelta(hours=max(0, int(settings.FINANCEIRO_CARENCIA_SAQUE_HORAS)))


def _ingressos_pagos_query(db: Session, organizador_id: str):
    return (
        db.query(Ingresso)
        .join(Evento, Ingresso.evento_id == Evento.id)
        .filter(
            Evento.organizador_id == organizador_id,
            Ingresso.status.in_(("pago", "usado")),
        )
    )


def _backfill_pago_em(db: Session, organizador_id: str, *, limit: int = 200) -> None:
    """Ingressos pagos antigos sem pago_em usam data_compra como referência."""
    rows = (
        _ingressos_pagos_query(db, organizador_id)
        .filter(Ingresso.pago_em.is_(None))
        .limit(limit)
        .all()
    )
    if not rows:
        return
    for ing in rows:
        ing.pago_em = ing.data_compra or _agora()
    db.commit()


def _ingressos_estornados_query(db: Session, organizador_id: str):
    return (
        db.query(Ingresso)
        .join(Evento, Ingresso.evento_id == Evento.id)
        .filter(
            Evento.organizador_id == organizador_id,
            Ingresso.status == "cancelado",
            Ingresso.liquido_repassado.isnot(None),
            Ingresso.asaas_payment_id.isnot(None),
        )
    )


def _backfill_ledger_pendentes(db: Session, organizador_id: str, *, limit: int = 100) -> None:
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


def _referencia_pagamento(ingresso: Ingresso) -> datetime:
    ref = getattr(ingresso, "pago_em", None) or ingresso.data_compra
    return ref or _agora()


def _liquido_ingresso(ingresso: Ingresso, tarifa) -> float:
    return liquido_ingresso_para_saldo(ingresso, tarifa)


def _calcular_saldos_ingressos(
    ingressos: list[Ingresso],
    tarifa,
) -> dict[str, Any]:
    agora = _agora()
    carencia = _carencia()
    liquido_total = 0.0
    em_carencia = 0.0
    liberado_bruto = 0.0
    proxima_liberacao: datetime | None = None
    proximo_valor = 0.0

    for ing in ingressos:
        liq = _liquido_ingresso(ing, tarifa)
        liquido_total = round(liquido_total + liq, 2)
        liberacao = _referencia_pagamento(ing) + carencia
        if liberacao > agora:
            em_carencia = round(em_carencia + liq, 2)
            if proxima_liberacao is None or liberacao < proxima_liberacao:
                proxima_liberacao = liberacao
                proximo_valor = liq
            elif liberacao == proxima_liberacao:
                proximo_valor = round(proximo_valor + liq, 2)
        else:
            liberado_bruto = round(liberado_bruto + liq, 2)

    return {
        "liquido_acumulado": liquido_total,
        "saldo_em_carencia": em_carencia,
        "saldo_liberado_bruto": liberado_bruto,
        "proxima_liberacao_em": proxima_liberacao.isoformat() if proxima_liberacao else None,
        "proxima_liberacao_valor": round(proximo_valor, 2) if proxima_liberacao else 0.0,
    }


def _totais_saques(db: Session, organizador_id: str) -> dict[str, float]:
    rows = (
        db.query(FinanceiroSaque.status, func.coalesce(func.sum(FinanceiroSaque.valor), 0))
        .filter(FinanceiroSaque.organizador_id == organizador_id)
        .group_by(FinanceiroSaque.status)
        .all()
    )
    por_status = {status: round(float(valor or 0), 2) for status, valor in rows}
    comprometidos = round(
        sum(por_status.get(s, 0.0) for s in _SAQUES_COMPROMETEM_SALDO),
        2,
    )
    return {
        "saques_reservados": comprometidos,
        "saques_pagos_total": por_status.get("pago", 0.0),
        "saques_pendentes": por_status.get("pendente", 0.0),
        "saques_processando": por_status.get("processando", 0.0),
    }


def saque_habilitado_para(usuario: Usuario) -> bool:
    if usuario.tipo != "organizador":
        return False
    if not organizador_repasse_aprovado(usuario):
        return False
    return organizador_tem_cliente_saque(usuario)


def calcular_saldo_organizador(db: Session, usuario: Usuario) -> dict[str, Any]:
    _backfill_pago_em(db, usuario.id)
    _backfill_ledger_pendentes(db, usuario.id)
    tarifa = tarifa_para_organizador(usuario)
    ingressos = _ingressos_pagos_query(db, usuario.id).all()
    bruto = round(sum(float(i.valor or 0) for i in ingressos), 2)
    taxa_total = round(
        sum(
            float(i.taxa_plataforma_aplicada)
            if getattr(i, "taxa_plataforma_aplicada", None) is not None
            else taxa_ingresso(float(i.valor or 0), tarifa)
            for i in ingressos
        ),
        2,
    )

    partes = _calcular_saldos_ingressos(ingressos, tarifa)
    saques = _totais_saques(db, usuario.id)
    disponivel = round(max(0.0, partes["saldo_liberado_bruto"] - saques["saques_reservados"]), 2)
    habilitado = saque_habilitado_para(usuario)
    carencia_h = int(settings.FINANCEIRO_CARENCIA_SAQUE_HORAS)
    prazo_h = int(settings.FINANCEIRO_PRAZO_TRANSFERENCIA_HORAS)

    nota_saque = (
        f"Valores ficam disponíveis para saque {carencia_h}h após a confirmação de cada pagamento. "
        f"Após solicitar a transferência via Pix, a efetivação ocorre em até {prazo_h}h."
        if habilitado
        else (
            "Com conta de recebimento vinculada, os repasses caem direto na sua conta via split. "
            "Solicite saques diretamente na sua conta de recebimento. Aqui você acompanha vendas e extrato."
            if settings.permite_vinculo_wallet_organizador()
            and organizador_repasse_aprovado(usuario)
            and not organizador_tem_cliente_saque(usuario)
            else (
                "Configure e aguarde a aprovação da sua conta de repasses para solicitar transferências "
                "diretamente por aqui, sem acessar outro sistema."
            )
        )
    )

    return {
        "plano_tarifa": tarifa.id,
        "rotulo_taxa": detalhar_taxa_ingresso(100, tarifa)["rotulo_taxa"],
        "receita_bruta": bruto,
        "taxa_plataforma_total": taxa_total,
        "liquido_acumulado": partes["liquido_acumulado"],
        "total_repassado_split": partes["liquido_acumulado"],
        "saldo_em_carencia": partes["saldo_em_carencia"],
        "saldo_liberado_bruto": partes["saldo_liberado_bruto"],
        "saques_reservados": saques["saques_reservados"],
        "saques_pagos_total": saques["saques_pagos_total"],
        "saques_pendentes": saques["saques_pendentes"],
        "saques_processando": saques["saques_processando"],
        "saldo_disponivel": disponivel,
        "saldo_disponivel_saque": disponivel,
        "carencia_horas": carencia_h,
        "prazo_transferencia_horas": prazo_h,
        "proxima_liberacao_em": partes["proxima_liberacao_em"],
        "proxima_liberacao_valor": partes["proxima_liberacao_valor"],
        "saque_habilitado": habilitado,
        "nota_saque": nota_saque,
        "ingressos_pagos": len(ingressos),
        "saldo_asaas": consultar_saldo_subconta(usuario),
    }


def _movimento_venda(ingresso: Ingresso, evento: Evento | None, tarifa) -> dict[str, Any]:
    val = float(ingresso.valor or 0)
    liquido = _liquido_ingresso(ingresso, tarifa)
    taxa = round(val - liquido, 2)
    if getattr(ingresso, "taxa_plataforma_aplicada", None) is not None:
        taxa = float(ingresso.taxa_plataforma_aplicada)
    ref = _referencia_pagamento(ingresso)
    carencia = _carencia()
    agora = _agora()
    liberacao = ref + carencia
    return {
        "tipo": "venda",
        "id": ingresso.id,
        "data": ref.isoformat(),
        "evento_id": ingresso.evento_id,
        "evento_nome": evento.nome if evento else "",
        "valor_ingresso": val,
        "taxa_plataforma": taxa,
        "liquido": liquido,
        "disponivel_saque_em": liberacao.isoformat(),
        "disponivel_saque": liberacao <= agora,
        "descricao": f"Ingresso — {evento.nome if evento else 'evento'}",
    }


def _movimento_estorno(ingresso: Ingresso, evento: Evento | None, tarifa) -> dict[str, Any]:
    liquido = _liquido_ingresso(ingresso, tarifa)
    ref = getattr(ingresso, "estornado_em", None) or ingresso.data_compra or _agora()
    return {
        "tipo": "estorno",
        "id": ingresso.id,
        "data": ref.isoformat() if ref else None,
        "evento_id": ingresso.evento_id,
        "evento_nome": evento.nome if evento else "",
        "valor": liquido,
        "descricao": f"Estorno — {evento.nome if evento else 'ingresso'}",
    }


def _movimento_saque(saque: FinanceiroSaque) -> dict[str, Any]:
    return {
        "tipo": "saque",
        "id": saque.id,
        "data": saque.criado_em.isoformat() if saque.criado_em else None,
        "valor": float(saque.valor),
        "status": saque.status,
        "pix_chave": saque.pix_chave,
        "pix_tipo": saque.pix_tipo,
        "previsao_liquidacao_em": (
            saque.previsao_liquidacao_em.isoformat() if saque.previsao_liquidacao_em else None
        ),
        "processado_em": saque.processado_em.isoformat() if saque.processado_em else None,
        "observacao": saque.observacao,
        "descricao": "Transferência via Pix",
    }


def listar_extrato(
    db: Session,
    usuario: Usuario,
    *,
    limite: int = 50,
    offset: int = 0,
) -> dict[str, Any]:
    _backfill_pago_em(db, usuario.id)
    _backfill_ledger_pendentes(db, usuario.id)
    tarifa = tarifa_para_organizador(usuario)

    saques_q = db.query(FinanceiroSaque).filter(FinanceiroSaque.organizador_id == usuario.id)
    total_saques = saques_q.count()
    total_vendas = _ingressos_pagos_query(db, usuario.id).count()
    total_estornos = _ingressos_estornados_query(db, usuario.id).count()
    total_movimentos = total_vendas + total_saques + total_estornos

    vendas_rows = (
        db.query(
            literal("venda").label("tipo"),
            Ingresso.id.label("rid"),
            func.coalesce(Ingresso.pago_em, Ingresso.data_compra).label("dt"),
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
    estornos_rows = (
        db.query(
            literal("estorno").label("tipo"),
            Ingresso.id.label("rid"),
            func.coalesce(Ingresso.estornado_em, Ingresso.data_compra).label("dt"),
        )
        .join(Evento, Ingresso.evento_id == Evento.id)
        .filter(
            Evento.organizador_id == usuario.id,
            Ingresso.status == "cancelado",
            Ingresso.liquido_repassado.isnot(None),
            Ingresso.asaas_payment_id.isnot(None),
        )
    )
    union_sub = union_all(vendas_rows.statement, saques_rows.statement, estornos_rows.statement).alias("mov")
    page = (
        db.query(union_sub.c.tipo, union_sub.c.rid, union_sub.c.dt)
        .order_by(union_sub.c.dt.desc())
        .offset(offset)
        .limit(limite)
        .all()
    )

    venda_ids = [rid for tipo, rid, _ in page if tipo == "venda"]
    estorno_ids = [rid for tipo, rid, _ in page if tipo == "estorno"]
    saque_ids = {rid for tipo, rid, _ in page if tipo == "saque"}

    all_ing_ids = list({*venda_ids, *estorno_ids})
    ingressos_map: dict[str, Ingresso] = {}
    if all_ing_ids:
        for ing in db.query(Ingresso).filter(Ingresso.id.in_(all_ing_ids)).all():
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
        elif tipo == "estorno":
            ing = ingressos_map.get(rid)
            if ing:
                movimentos.append(_movimento_estorno(ing, eventos.get(ing.evento_id), tarifa))
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


def listar_saques(db: Session, usuario: Usuario, *, limite: int = 50) -> list[dict[str, Any]]:
    rows = (
        db.query(FinanceiroSaque)
        .filter(FinanceiroSaque.organizador_id == usuario.id)
        .order_by(FinanceiroSaque.criado_em.desc())
        .limit(limite)
        .all()
    )
    return [_movimento_saque(s) for s in rows]


def _rotulo_periodo(dt: datetime, agrupamento: AgrupamentoVendas) -> str:
    if agrupamento == "dia":
        return dt.strftime("%Y-%m-%d")
    if agrupamento == "semana":
        iso = dt.isocalendar()
        return f"{iso.year}-W{iso.week:02d}"
    if agrupamento == "mes":
        return dt.strftime("%Y-%m")
    if agrupamento == "ano":
        return dt.strftime("%Y")
    return dt.isoformat()


def listar_vendas_agrupadas(
    db: Session,
    usuario: Usuario,
    *,
    agrupamento: AgrupamentoVendas = "mes",
    de: datetime | None = None,
    ate: datetime | None = None,
) -> dict[str, Any]:
    _backfill_ledger_pendentes(db, usuario.id)
    tarifa = tarifa_para_organizador(usuario)
    ingressos = _ingressos_pagos_query(db, usuario.id).all()
    evento_ids = {i.evento_id for i in ingressos if i.evento_id}
    eventos = {
        e.id: e.nome
        for e in db.query(Evento).filter(Evento.id.in_(evento_ids)).all()
    } if evento_ids else {}

    grupos: dict[str, dict[str, Any]] = {}
    for ing in ingressos:
        evento_nome = eventos.get(ing.evento_id, "")
        ref = _referencia_pagamento(ing)
        if de and ref < de:
            continue
        if ate and ref > ate:
            continue
        val = float(ing.valor or 0)
        liq = _liquido_ingresso(ing, tarifa)
        taxa = float(ing.taxa_plataforma_aplicada) if ing.taxa_plataforma_aplicada is not None else round(val - liq, 2)

        if agrupamento == "evento":
            chave = ing.evento_id or "sem_evento"
            rotulo = evento_nome or "Sem evento"
        else:
            chave = _rotulo_periodo(ref, agrupamento)
            rotulo = chave

        bucket = grupos.setdefault(
            chave,
            {
                "chave": chave,
                "rotulo": rotulo,
                "evento_id": ing.evento_id if agrupamento == "evento" else None,
                "evento_nome": evento_nome if agrupamento == "evento" else None,
                "ingressos": 0,
                "receita_bruta": 0.0,
                "taxa_plataforma": 0.0,
                "liquido": 0.0,
            },
        )
        bucket["ingressos"] += 1
        bucket["receita_bruta"] = round(bucket["receita_bruta"] + val, 2)
        bucket["taxa_plataforma"] = round(bucket["taxa_plataforma"] + taxa, 2)
        bucket["liquido"] = round(bucket["liquido"] + liq, 2)

    lista = sorted(grupos.values(), key=lambda g: g["rotulo"], reverse=True)
    totais = {
        "ingressos": sum(g["ingressos"] for g in lista),
        "receita_bruta": round(sum(g["receita_bruta"] for g in lista), 2),
        "taxa_plataforma": round(sum(g["taxa_plataforma"] for g in lista), 2),
        "liquido": round(sum(g["liquido"] for g in lista), 2),
    }
    return {
        "agrupamento": agrupamento,
        "periodo": {
            "de": de.isoformat() if de else None,
            "ate": ate.isoformat() if ate else None,
        },
        "grupos": lista,
        "totais": totais,
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
    if not saque_habilitado_para(usuario):
        raise ValueError(
            "Saque indisponível. Conclua a abertura e aprovação da conta de repasses em Financeiro."
        )

    valor_f = round(float(valor), 2)
    if valor_f < 1.0:
        raise ValueError("O valor mínimo para saque é R$ 1,00.")

    chave = (pix_chave or "").strip()
    if len(chave) < 5:
        raise ValueError("Informe uma chave Pix válida.")

    tipo = inferir_pix_tipo(chave, pix_tipo)
    chave_norm = normalizar_pix_chave(chave, tipo)
    validar_pix_cadastro_repasse(usuario, chave_norm, tipo)

    saldo = calcular_saldo_organizador(db, usuario)
    disponivel = float(saldo["saldo_disponivel_saque"])
    if valor_f > disponivel + 0.009:
        raise ValueError(
            f"Saldo disponível para saque: R$ {disponivel:.2f}. "
            f"Valores em carência ({saldo['carencia_horas']}h após confirmação) ainda não podem ser sacados."
        )

    # Reserva saldo com lock pessimista contra saques concorrentes.
    reservado = (
        db.query(func.coalesce(func.sum(FinanceiroSaque.valor), 0))
        .filter(
            FinanceiroSaque.organizador_id == usuario.id,
            FinanceiroSaque.status.in_(_SAQUES_COMPROMETEM_SALDO),
        )
        .with_for_update()
        .scalar()
    )
    liberado = float(saldo["saldo_liberado_bruto"])
    disponivel_locked = round(max(0.0, liberado - float(reservado or 0)), 2)
    if valor_f > disponivel_locked + 0.009:
        raise ValueError(f"Saldo disponível para saque: R$ {disponivel_locked:.2f}.")

    from app.services.organizador_asaas import _client_subconta

    sub_client = _client_subconta(usuario)
    if not sub_client:
        raise ValueError("Conta de repasses não configurada.")

    agora = _agora()
    saque = FinanceiroSaque(
        organizador_id=usuario.id,
        valor=valor_f,
        pix_chave=chave_norm,
        pix_tipo=tipo,
        status="pendente",
        previsao_liquidacao_em=previsao_liquidacao_saque(agora),
        criado_em=agora,
        atualizado_em=agora,
    )
    db.add(saque)
    db.flush()

    try:
        transfer = criar_transferencia_pix(
            sub_client,
            valor=valor_f,
            pix_chave=chave_norm,
            pix_tipo=tipo,
            external_reference=saque.id,
        )
    except Exception as e:
        from app.services.asaas_client import AsaasAPIError

        saque.status = "rejeitado"
        saque.observacao = str(e)[:500]
        saque.atualizado_em = _agora()
        db.commit()
        db.refresh(saque)
        msg = saque.observacao
        if isinstance(e, AsaasAPIError) and e.errors:
            msg = e.errors[0].get("description") or msg
        raise ValueError(msg or "Não foi possível solicitar a transferência.") from e

    saque.asaas_transfer_id = str(transfer.get("id") or "") or None
    saque.status = "processando"
    saque.atualizado_em = _agora()
    status_asaas = (transfer.get("status") or "").upper()
    if status_asaas in ("DONE", "BANK_PROCESSING_DONE"):
        saque.status = "pago"
        saque.processado_em = agora

        from app.services.saque_notificacao import notificar_saque_pago

        notificar_saque_pago(db, saque, usuario=usuario)
    db.commit()
    db.refresh(saque)
    return saque


def obter_comprovante_saque(db: Session, usuario: Usuario, saque_id: str) -> dict[str, Any]:
    saque = (
        db.query(FinanceiroSaque)
        .filter(
            FinanceiroSaque.id == saque_id,
            FinanceiroSaque.organizador_id == usuario.id,
        )
        .first()
    )
    if not saque:
        raise ValueError("Saque não encontrado.")
    return comprovante_saque(saque, usuario)


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
    if saque.status not in ("pendente", "processando"):
        raise ValueError("Só é possível cancelar solicitações ainda não concluídas.")
    if saque.status == "processando" and saque.asaas_transfer_id:
        from app.services.organizador_asaas import _client_subconta

        sub = _client_subconta(usuario)
        if sub:
            try:
                sub.delete(f"/v3/transfers/{saque.asaas_transfer_id}")
            except Exception:
                raise ValueError(
                    "Não foi possível cancelar a transferência no banco. "
                    "Aguarde a conclusão ou contate o suporte."
                ) from None
    saque.status = "cancelado"
    saque.atualizado_em = _agora()
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


__all__ = [
    "calcular_saldo_organizador",
    "cancelar_saque",
    "listar_extrato",
    "listar_saques",
    "listar_vendas_agrupadas",
    "obter_comprovante_saque",
    "registrar_ledger_ingressos_lote",
    "solicitar_saque",
]
