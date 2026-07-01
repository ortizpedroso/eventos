"""Rotas administrativas da plataforma (painel marketing)."""

from __future__ import annotations

import csv
import io
import logging
from typing import Literal

logger = logging.getLogger(__name__)

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy.orm import Session, joinedload

from app.deps.platform_admin import require_platform_admin
from sqlalchemy import func

from app.models import CampanhaMarketing, Evento, Usuario, get_db
from app.services.production_checks import build_setup_status
from app.schemas.campanha_marketing import CampanhaCreate, CampanhaDetalheResponse, CampanhaResponse
from app.services.marketing_campanha import criar_campanha, disparar_campanha
from app.services.marketing_contatos import (
    CanalMarketing,
    buscar_contatos_marketing,
    listar_contatos_marketing,
    usuario_para_export_row,
)

router = APIRouter(dependencies=[Depends(require_platform_admin)])


class EventoPublicadoUpdate(BaseModel):
    publicado: bool


class UsuarioAtivoUpdate(BaseModel):
    ativo: bool


class AssinaturaAdminUpdate(BaseModel):
    plano_tarifa: Literal["padrao", "assinatura"] = "assinatura"
    meses: int = Field(default=1, ge=1, le=24)


@router.patch("/organizadores/{usuario_id}/assinatura")
async def admin_atualizar_assinatura(
    usuario_id: str,
    body: AssinaturaAdminUpdate,
    db: Session = Depends(get_db),
):
    """Ativa ou cancela assinatura de organizador (admin plataforma)."""
    from app.services.assinatura_organizador import cancelar_assinatura, renovar_assinatura_meses

    usuario = db.get(Usuario, usuario_id)
    if not usuario or usuario.tipo != "organizador":
        raise HTTPException(status_code=404, detail="Organizador não encontrado.")
    if body.plano_tarifa == "assinatura":
        renovar_assinatura_meses(db, usuario, meses=body.meses)
    else:
        cancelar_assinatura(db, usuario)
    logger.info(
        "admin_action=atualizar_assinatura usuario_id=%s plano=%s meses=%s",
        usuario_id, body.plano_tarifa, body.meses,
    )
    return {"id": usuario.id, "plano_tarifa": usuario.plano_tarifa, "assinatura_valida_ate": usuario.assinatura_valida_ate}


@router.get("/setup")
async def status_setup():
    """Checklist de produção (sem segredos)."""
    return build_setup_status()


class SmtpTestBody(BaseModel):
    destino: EmailStr


@router.post("/smtp-test")
async def testar_smtp(body: SmtpTestBody):
    """Envia e-mail de teste para validar SMTP (requer X-Platform-Admin-Key)."""
    from app.services.smtp_client import send_test_email, smtp_configured

    if not smtp_configured():
        raise HTTPException(
            status_code=503,
            detail="SMTP não configurado. Defina EMAIL_USER e EMAIL_PASSWORD no .env da API.",
        )
    destino = str(body.destino).strip()
    ok = send_test_email(destino)
    if not ok:
        raise HTTPException(status_code=502, detail="Falha ao enviar e-mail de teste.")
    return {"ok": True, "message": f"E-mail de teste enviado para {destino}."}


@router.get("/eventos")
async def listar_eventos_plataforma(
    publicado: bool | None = Query(None),
    q: str | None = Query(None, max_length=120),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
):
    query = db.query(Evento).options(joinedload(Evento.organizador))
    if publicado is not None:
        query = query.filter(Evento.publicado == publicado)
    if q:
        like = f"%{q.strip()}%"
        query = query.filter(Evento.nome.ilike(like) | Evento.slug.ilike(like))
    total = query.count()
    rows = query.order_by(Evento.data_criacao.desc()).offset(offset).limit(limit).all()
    return {
        "total": total,
        "limit": limit,
        "offset": offset,
        "eventos": [
            {
                "id": e.id,
                "slug": e.slug,
                "nome": e.nome,
                "publicado": bool(e.publicado),
                "data_inicio": e.data_inicio.isoformat() if e.data_inicio else None,
                "organizador_nome": e.organizador.nome if e.organizador else None,
                "organizador_email": e.organizador.email if e.organizador else None,
            }
            for e in rows
        ],
    }


@router.patch("/eventos/{evento_id}/publicado")
async def atualizar_publicacao_evento(
    evento_id: str,
    body: EventoPublicadoUpdate,
    db: Session = Depends(get_db),
):
    evento = db.query(Evento).filter(Evento.id == evento_id).first()
    if not evento:
        raise HTTPException(status_code=404, detail="Evento não encontrado")
    evento.publicado = body.publicado
    db.commit()
    db.refresh(evento)
    logger.info(
        "admin_action=atualizar_publicacao evento_id=%s publicado=%s",
        evento_id, body.publicado,
    )
    return {
        "id": evento.id,
        "slug": evento.slug,
        "nome": evento.nome,
        "publicado": bool(evento.publicado),
    }


@router.get("/usuarios")
async def listar_usuarios_plataforma(
    ativo: bool | None = Query(None),
    tipo: Literal["cliente", "organizador"] | None = Query(None),
    q: str | None = Query(None, max_length=120),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
):
    query = db.query(Usuario)
    if ativo is not None:
        query = query.filter(Usuario.ativo == ativo)
    if tipo:
        query = query.filter(Usuario.tipo == tipo)
    if q:
        like = f"%{q.strip()}%"
        query = query.filter(
            Usuario.nome.ilike(like)
            | Usuario.email.ilike(like)
            | func.coalesce(Usuario.telefone, "").ilike(like)
        )
    total = query.count()
    rows = query.order_by(Usuario.data_criacao.desc()).offset(offset).limit(limit).all()
    return {
        "total": total,
        "limit": limit,
        "offset": offset,
        "usuarios": [
            {
                "id": u.id,
                "email": u.email,
                "nome": u.nome,
                "tipo": u.tipo,
                "ativo": bool(u.ativo),
                "telefone": u.telefone,
                "aceita_comunicacao_email": bool(u.aceita_comunicacao_email),
                "aceita_comunicacao_whatsapp": bool(u.aceita_comunicacao_whatsapp),
                "data_criacao": u.data_criacao.isoformat() if u.data_criacao else None,
            }
            for u in rows
        ],
    }


@router.patch("/usuarios/{usuario_id}/ativo")
async def atualizar_status_usuario(
    usuario_id: str,
    body: UsuarioAtivoUpdate,
    db: Session = Depends(get_db),
):
    usuario = db.query(Usuario).filter(Usuario.id == usuario_id).first()
    if not usuario:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")
    usuario.ativo = body.ativo
    if not body.ativo:
        usuario.token_version = int(usuario.token_version or 0) + 1
    db.commit()
    db.refresh(usuario)
    logger.info(
        "admin_action=atualizar_status_usuario usuario_id=%s ativo=%s",
        usuario_id, body.ativo,
    )
    return {
        "id": usuario.id,
        "email": usuario.email,
        "nome": usuario.nome,
        "ativo": bool(usuario.ativo),
    }


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
        def _csv_safe(value: str | None) -> str:
            """Prefixo ' em campos que iniciam com =+-@ para evitar CSV/formula injection."""
            v = str(value or "").strip()
            if v and v[0] in ("=", "+", "-", "@", "\t", "\r"):
                return "'" + v
            return v

        buf = io.StringIO()
        w = csv.writer(buf, delimiter=";", lineterminator="\n")
        w.writerow(
            ["id", "nome", "email", "telefone", "tipo", "aceita_email", "aceita_whatsapp", "consentimento_em"]
        )
        for r in rows:
            w.writerow(
                [
                    r["id"],
                    _csv_safe(r["nome"]),
                    _csv_safe(r["email"]),
                    _csv_safe(r["telefone"] or ""),
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
            logger.info(
                "admin_action=disparar_campanha campanha_id=%s canal=%s",
                campanha.id, body.canal,
            )
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
