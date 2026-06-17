"""Notificações in-app do usuário."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.models import Usuario, UsuarioNotificacao, get_db
from app.routes.auth import get_usuario_atual

router = APIRouter()


class NotificacaoResponse(BaseModel):
    id: str
    tipo: str
    titulo: str
    mensagem: str
    link: str | None
    lida: bool
    data_criacao: str

    model_config = {"from_attributes": True}


@router.get("", response_model=list[NotificacaoResponse])
async def listar_notificacoes(
    usuario_atual: Usuario = Depends(get_usuario_atual),
    db: Session = Depends(get_db),
    nao_lidas: bool = False,
):
    q = db.query(UsuarioNotificacao).filter(UsuarioNotificacao.usuario_id == usuario_atual.id)
    if nao_lidas:
        q = q.filter(UsuarioNotificacao.lida.is_(False))
    rows = q.order_by(UsuarioNotificacao.data_criacao.desc()).limit(50).all()
    return [
        NotificacaoResponse(
            id=r.id,
            tipo=r.tipo,
            titulo=r.titulo,
            mensagem=r.mensagem,
            link=r.link,
            lida=r.lida,
            data_criacao=r.data_criacao.isoformat() if r.data_criacao else "",
        )
        for r in rows
    ]


@router.get("/contagem")
async def contagem_nao_lidas(
    usuario_atual: Usuario = Depends(get_usuario_atual),
    db: Session = Depends(get_db),
):
    n = (
        db.query(UsuarioNotificacao)
        .filter(UsuarioNotificacao.usuario_id == usuario_atual.id, UsuarioNotificacao.lida.is_(False))
        .count()
    )
    return {"nao_lidas": n}


@router.post("/{notificacao_id}/lida")
async def marcar_lida(
    notificacao_id: str,
    usuario_atual: Usuario = Depends(get_usuario_atual),
    db: Session = Depends(get_db),
):
    row = db.get(UsuarioNotificacao, notificacao_id)
    if not row or row.usuario_id != usuario_atual.id:
        raise HTTPException(status_code=404, detail="Notificação não encontrada")
    row.lida = True
    db.commit()
    return {"ok": True}
