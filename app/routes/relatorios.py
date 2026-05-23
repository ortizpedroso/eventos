"""Relatórios agregados para organizadores (vendas, status, série temporal)."""

from __future__ import annotations

import csv
import io
from collections import defaultdict
from datetime import date, datetime, timedelta
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy.orm import Session, joinedload

from app.models import Evento, Ingresso, Usuario, get_db
from app.routes.auth import get_usuario_atual
from app.services.export_presenca import gerar_pdf_participantes, gerar_xlsx_participantes
from app.services.metricas_evento import taxa_conversao_por_status, vagas_restantes_evento
from app.services.tarifas_plataforma import liquido_organizador, taxa_ingresso
from app.utils.privacy import mask_cpf, mask_telefone_br

router = APIRouter()

STATUSES = ("pendente", "pago", "cancelado", "usado")


def _ingress_date(data_compra: datetime | None) -> date | None:
    if data_compra is None:
        return None
    if isinstance(data_compra, datetime):
        return data_compra.date()
    return None


def _require_organizador(usuario_atual: Usuario) -> None:
    if usuario_atual.tipo != "organizador":
        raise HTTPException(status_code=403, detail="Apenas organizadores acessam relatórios")


@router.get("/organizador")
async def relatorio_organizador(
    usuario_atual: Usuario = Depends(get_usuario_atual),
    db: Session = Depends(get_db),
    dias: int = Query(90, ge=7, le=366, description="Janela do gráfico diário (últimos N dias)"),
    evento_id: str | None = Query(None, description="Filtra todos os blocos por um evento"),
):
    """
    Resumo de ingressos dos eventos do organizador: totais por status, receita,
    comparativo por evento e série diária de vendas confirmadas.
    """
    _require_organizador(usuario_atual)

    q = (
        db.query(Ingresso)
        .join(Evento, Ingresso.evento_id == Evento.id)
        .filter(Evento.organizador_id == usuario_atual.id)
    )
    if evento_id:
        ev = db.get(Evento, evento_id)
        if not ev or ev.organizador_id != usuario_atual.id:
            raise HTTPException(status_code=404, detail="Evento não encontrado")
        q = q.filter(Evento.id == evento_id)

    ingressos = q.all()

    evento_ids = {i.evento_id for i in ingressos}
    eventos_map: dict[str, Evento] = {}
    if evento_ids:
        for e in (
            db.query(Evento)
            .options(joinedload(Evento.ingresso_lotes))
            .filter(Evento.id.in_(evento_ids))
            .all()
        ):
            eventos_map[e.id] = e

    by_status: dict[str, int] = {s: 0 for s in STATUSES}
    by_status_outros = 0
    receita_paga = 0.0
    receita_pendente = 0.0
    taxa_plataforma = 0.0
    liquido_estimado = 0.0

    por_evento: dict[str, dict] = {}

    def bucket_evento(eid: str) -> dict:
        if eid not in por_evento:
            evo = eventos_map.get(eid)
            por_evento[eid] = {
                "evento_id": eid,
                "nome": evo.nome if evo else "",
                "slug": evo.slug if evo else "",
                "publicado": bool(evo.publicado) if evo else True,
                "por_status": {s: 0 for s in STATUSES},
                "receita_paga": 0.0,
                "total_ingressos": 0,
                "vagas_restantes": vagas_restantes_evento(db, evo) if evo else None,
                "conversao_pct": None,
            }
        return por_evento[eid]

    today = date.today()
    start_chart = today - timedelta(days=dias - 1)
    serie_map: dict[date, dict[str, float | int]] = defaultdict(
        lambda: {"ingressos_pagos": 0, "receita": 0.0}
    )

    mes_start = date(today.year, today.month, 1)
    mes_counts = {s: 0 for s in STATUSES}
    mes_receita_paga = 0.0

    for ing in ingressos:
        st = (ing.status or "pendente").lower()
        if st in by_status:
            by_status[st] += 1
        else:
            by_status_outros += 1

        pe = bucket_evento(ing.evento_id)
        pe["total_ingressos"] += 1
        if st in pe["por_status"]:
            pe["por_status"][st] += 1

        val = float(ing.valor or 0)
        if st == "pago":
            receita_paga += val
            pe["receita_paga"] += val
            taxa_plataforma += taxa_ingresso(val)
            liquido_estimado += liquido_organizador(val)
        elif st == "pendente":
            receita_pendente += val

        d = _ingress_date(ing.data_compra)
        if d and d >= start_chart and st == "pago":
            serie_map[d]["ingressos_pagos"] = int(serie_map[d]["ingressos_pagos"]) + 1
            serie_map[d]["receita"] = float(serie_map[d]["receita"]) + val

        if d and d >= mes_start:
            if st in mes_counts:
                mes_counts[st] += 1
            if st == "pago":
                mes_receita_paga += val

    serie_list: list[dict] = []
    d = start_chart
    while d <= today:
        slot = serie_map.get(d, {"ingressos_pagos": 0, "receita": 0.0})
        serie_list.append(
            {
                "dia": d.isoformat(),
                "ingressos_pagos": int(slot["ingressos_pagos"]),
                "receita": round(float(slot["receita"]), 2),
            }
        )
        d += timedelta(days=1)

    full_ev = (
        db.query(Evento)
        .options(joinedload(Evento.ingresso_lotes))
        .filter(Evento.organizador_id == usuario_atual.id)
        .order_by(Evento.nome.asc())
        .all()
    )
    opcoes_evento = [
        {"evento_id": e.id, "nome": e.nome, "publicado": bool(e.publicado)} for e in full_ev
    ]
    all_ev = full_ev
    if evento_id:
        all_ev = [e for e in all_ev if e.id == evento_id]
    por_evento_list: list[dict] = []
    for ev in all_ev:
        base = por_evento.get(ev.id)
        if not base:
            base = {
                "evento_id": ev.id,
                "nome": ev.nome,
                "slug": ev.slug,
                "publicado": bool(ev.publicado),
                "por_status": {s: 0 for s in STATUSES},
                "receita_paga": 0.0,
                "total_ingressos": 0,
            }
        base = dict(base)
        base["receita_paga"] = round(float(base["receita_paga"]), 2)
        base["vagas_restantes"] = vagas_restantes_evento(db, ev)
        base["conversao_pct"] = taxa_conversao_por_status(base["por_status"])
        por_evento_list.append(base)

    por_evento_list.sort(key=lambda x: (-int(x["total_ingressos"]), str(x["nome"]).lower()))

    resumo_status = dict(by_status)
    if by_status_outros:
        resumo_status["outros"] = by_status_outros

    return {
        "resumo": {
            "total_ingressos": len(ingressos),
            "por_status": resumo_status,
            "receita_confirmada": round(receita_paga, 2),
            "receita_em_aberto": round(receita_pendente, 2),
        },
        "financeiro": {
            "receita_bruta": round(receita_paga, 2),
            "taxa_plataforma_estimada": round(taxa_plataforma, 2),
            "liquido_estimado": round(liquido_estimado, 2),
            "nota": "Taxa estimada (10% + R$ 2/ingresso pago), alinhada à página de planos.",
        },
        "mes_atual": {
            "referencia": today.strftime("%Y-%m"),
            "por_status": mes_counts,
            "receita_confirmada": round(mes_receita_paga, 2),
        },
        "por_evento": por_evento_list,
        "serie_diaria": serie_list,
        "periodo_grafico_dias": dias,
        "opcoes_evento": opcoes_evento,
    }


@router.get("/organizador/participantes")
async def participantes_organizador(
    usuario_atual: Usuario = Depends(get_usuario_atual),
    db: Session = Depends(get_db),
    evento_id: str | None = Query(None),
    limite: int = Query(2000, ge=1, le=5000),
    formato: Literal["json", "csv", "pdf", "xlsx"] = Query("json"),
    mascarar_sensiveis: bool = Query(
        True,
        description="Se true, mascara CPF e telefone na exportação (útil para partilhar ficheiros).",
    ),
):
    """
    Lista participantes (nome/e-mail informados na compra) dos eventos do organizador.
    Use `evento_id` para exportar um evento; sem filtro, retorna até `limite` registros recentes.
    """
    _require_organizador(usuario_atual)

    q = (
        db.query(Ingresso)
        .join(Evento, Ingresso.evento_id == Evento.id)
        .filter(Evento.organizador_id == usuario_atual.id)
    )
    if evento_id:
        ev = db.get(Evento, evento_id)
        if not ev or ev.organizador_id != usuario_atual.id:
            raise HTTPException(status_code=404, detail="Evento não encontrado")
        q = q.filter(Evento.id == evento_id)

    rows_db = q.order_by(Ingresso.data_compra.desc()).limit(limite).all()

    rows_out: list[dict] = []
    for ing in rows_db:
        cpf_raw = ing.participante_cpf or ""
        tel_raw = ing.participante_telefone or ""
        rows_out.append(
            {
                "evento_nome": ing.evento.nome,
                "participante_nome": ing.participante_nome or "",
                "participante_email": ing.participante_email or "",
                "participante_cpf": (mask_cpf(ing.participante_cpf) or "")
                if mascarar_sensiveis
                else cpf_raw,
                "participante_telefone": (mask_telefone_br(ing.participante_telefone) or "")
                if mascarar_sensiveis
                else tel_raw,
                "status": ing.status or "",
                "valor": float(ing.valor or 0),
                "data_compra": ing.data_compra.isoformat() if ing.data_compra else None,
                "checkin_em": ing.checkin_em.isoformat() if ing.checkin_em else None,
            }
        )

    if formato == "json":
        return {"participantes": rows_out, "total": len(rows_out)}

    titulo = "Lista de presença — EventosBR"
    if evento_id and rows_db:
        titulo = f"Lista — {rows_db[0].evento.nome}"

    if formato == "pdf":
        pdf_bytes = gerar_pdf_participantes(rows_out, titulo)
        filename = "lista_presenca.pdf"
        if evento_id and rows_db:
            safe = "".join(c for c in rows_db[0].evento.nome if c.isalnum() or c in " -_")[:40].strip()
            if safe:
                filename = f"lista_{safe.replace(' ', '_')}.pdf"
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )

    if formato == "xlsx":
        xlsx_bytes = gerar_xlsx_participantes(rows_out)
        filename = "lista_presenca.xlsx"
        if evento_id and rows_db:
            safe = "".join(c for c in rows_db[0].evento.nome if c.isalnum() or c in " -_")[:40].strip()
            if safe:
                filename = f"lista_{safe.replace(' ', '_')}.xlsx"
        return Response(
            content=xlsx_bytes,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )

    buf = io.StringIO()
    w = csv.writer(buf, delimiter=";", lineterminator="\n")
    w.writerow(
        [
            "evento",
            "participante_nome",
            "participante_email",
            "participante_cpf",
            "participante_telefone",
            "status",
            "valor",
            "data_compra",
            "checkin_em",
        ]
    )
    for r in rows_out:
        w.writerow(
            [
                r["evento_nome"],
                r["participante_nome"],
                r["participante_email"],
                r["participante_cpf"],
                r["participante_telefone"],
                r["status"],
                str(r["valor"]).replace(".", ","),
                r["data_compra"] or "",
                r.get("checkin_em") or "",
            ]
        )
    body = buf.getvalue()
    filename = "participantes_eventosbr.csv"
    if evento_id and rows_db:
        safe = "".join(c for c in rows_db[0].evento.nome if c.isalnum() or c in " -_")[:40].strip()
        if safe:
            filename = f"participantes_{safe.replace(' ', '_')}.csv"
    return Response(
        content=("\ufeff" + body).encode("utf-8"),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
