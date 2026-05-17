"""Rotas administrativas da plataforma (painel marketing)."""

from __future__ import annotations

import csv
import io
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response
from sqlalchemy.orm import Session, joinedload

from app.deps.platform_admin import require_platform_admin
from app.models import CampanhaMarketing, get_db
from app.schemas.campanha_marketing import CampanhaCreate, CampanhaDetalheResponse, CampanhaResponse
from app.services.marketing_campanha import criar_campanha, disparar_campanha
from app.services.marketing_contatos import (
    CanalMarketing,
    buscar_contatos_marketing,
    listar_contatos_marketing,
    usuario_para_export_row,
)

router = APIRouter(dependencies=[Depends(require_platform_admin)])


@router.get("/marketing/contatos")
async def listar_contatos(
    canal: CanalMarketing = Query("qualquer"),
    q: str | None = Query(None, max_length=120),
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
    formato: Literal["json", "csv"] = Query("json"),
    db: Session = Depends(get_db),
):
    if formato == "csv":
        usuarios = listar_contatos_marketing(db, canal=canal)
        if q:
            usuarios, _ = buscar_contatos_marketing(db, canal=canal, q=q, limit=5000, offset=0)
        rows = [usuario_para_export_row(u) for u in usuarios]
        buf = io.StringIO()
        w = csv.writer(buf, delimiter=";", lineterminator="\n")
        w.writerow(
            ["id", "nome", "email", "telefone", "tipo", "aceita_email", "aceita_whatsapp", "consentimento_em"]
        )
        for r in rows:
            w.writerow(
                [
                    r["id"],
                    r["nome"],
                    r["email"],
                    r["telefone"] or "",
                    r["tipo"],
                    "sim" if r["aceita_comunicacao_email"] else "nao",
                    "sim" if r["aceita_comunicacao_whatsapp"] else "nao",
                    r["comunicacao_consentimento_em"] or "",
                ]
            )
        return Response(
            content="\ufeff" + buf.getvalue(),
            media_type="text/csv; charset=utf-8",
            headers={"Content-Disposition": f'attachment; filename="contatos_{canal}.csv"'},
        )

    usuarios, total = buscar_contatos_marketing(db, canal=canal, q=q, limit=limit, offset=offset)
    return {
        "canal": canal,
        "q": q,
        "total": total,
        "limit": limit,
        "offset": offset,
        "contatos": [usuario_para_export_row(u) for u in usuarios],
    }


@router.get("/marketing/campanhas", response_model=list[CampanhaResponse])
async def listar_campanhas(
    limit: int = Query(30, ge=1, le=100),
    db: Session = Depends(get_db),
):
    rows = (
        db.query(CampanhaMarketing)
        .order_by(CampanhaMarketing.criado_em.desc())
        .limit(limit)
        .all()
    )
    return [CampanhaResponse.model_validate(c) for c in rows]


@router.post("/marketing/campanhas", response_model=CampanhaResponse)
async def criar_campanha_marketing(
    body: CampanhaCreate,
    db: Session = Depends(get_db),
):
    campanha = criar_campanha(
        db,
        nome=body.nome,
        assunto=body.assunto,
        mensagem=body.mensagem,
        canal=body.canal,
        usuario_ids=body.usuario_ids,
        busca=body.busca,
        filtro_canal=body.filtro_canal,
    )
    if body.disparar_agora:
        try:
            campanha = disparar_campanha(db, campanha.id)
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e)) from e
    return CampanhaResponse.model_validate(campanha)


@router.get("/marketing/campanhas/{campanha_id}", response_model=CampanhaDetalheResponse)
async def detalhe_campanha(campanha_id: str, db: Session = Depends(get_db)):
    campanha = (
        db.query(CampanhaMarketing)
        .options(joinedload(CampanhaMarketing.envios))
        .filter(CampanhaMarketing.id == campanha_id)
        .first()
    )
    if not campanha:
        raise HTTPException(status_code=404, detail="Campanha não encontrada")
    return CampanhaDetalheResponse.model_validate(campanha)


@router.post("/marketing/campanhas/{campanha_id}/disparar", response_model=CampanhaResponse)
async def disparar_campanha_marketing(campanha_id: str, db: Session = Depends(get_db)):
    try:
        campanha = disparar_campanha(db, campanha_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    return CampanhaResponse.model_validate(campanha)
