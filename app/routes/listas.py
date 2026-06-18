"""Listas de interesse e espera."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy.orm import Session

from app.deps.rate_limit import rate_limit_lista_publica
from app.models import Evento, Usuario, get_db
from app.routes.auth import get_usuario_atual_opcional
from app.services.lista_espera import inscrever_espera, validar_token_espera
from app.services.lista_interesse import inscrever_interesse

router = APIRouter()


class InscricaoInteresseRequest(BaseModel):
    email: EmailStr
    nome: str | None = Field(default=None, max_length=120)


class InscricaoEsperaRequest(BaseModel):
    email: EmailStr
    nome: str | None = Field(default=None, max_length=120)


@router.post("/interesse/{slug}")
async def inscrever_lista_interesse(
    slug: str,
    body: InscricaoInteresseRequest,
    request: Request,
    db: Session = Depends(get_db),
):
    rate_limit_lista_publica(request, slug)
    evento = db.query(Evento).filter(Evento.slug == slug, Evento.publicado.is_(True)).first()
    if not evento:
        raise HTTPException(status_code=404, detail="Evento não encontrado")
    if not evento.aceita_interesse:
        raise HTTPException(status_code=400, detail="Este evento não aceita lista de interesse.")
    from app.services.ingresso_lotes import vendas_ainda_nao_abertas

    if not vendas_ainda_nao_abertas(db, evento):
        raise HTTPException(
            status_code=400,
            detail="Lista de interesse só aceita inscrições antes da abertura das vendas.",
        )
    row = inscrever_interesse(db, evento, email=str(body.email), nome=body.nome)
    return {"ok": True, "email": row.email, "mensagem": "Inscrição registrada. Avisaremos quando as vendas abrirem."}


@router.post("/espera/{slug}")
async def inscrever_lista_espera(
    slug: str,
    body: InscricaoEsperaRequest,
    request: Request,
    db: Session = Depends(get_db),
    usuario: Usuario | None = Depends(get_usuario_atual_opcional),
):
    rate_limit_lista_publica(request, slug)
    evento = db.query(Evento).filter(Evento.slug == slug, Evento.publicado.is_(True)).first()
    if not evento:
        raise HTTPException(status_code=404, detail="Evento não encontrado")
    row = inscrever_espera(
        db,
        evento,
        email=str(body.email),
        nome=body.nome or (usuario.nome if usuario else None),
        usuario=usuario,
    )
    return {
        "ok": True,
        "posicao": row.posicao,
        "email": row.email,
        "mensagem": f"Você entrou na fila (posição {row.posicao}). Avisaremos por e-mail quando houver vaga.",
    }


@router.get("/espera/validar/{slug}")
async def validar_link_espera(
    slug: str,
    token: str,
    db: Session = Depends(get_db),
):
    evento = db.query(Evento).filter(Evento.slug == slug).first()
    if not evento:
        raise HTTPException(status_code=404, detail="Evento não encontrado")
    entrada = validar_token_espera(db, evento, token)
    if not entrada:
        raise HTTPException(status_code=400, detail="Link inválido ou expirado.")
    return {"ok": True, "email": entrada.email, "expira_em": entrada.token_expira_em.isoformat() if entrada.token_expira_em else None}
