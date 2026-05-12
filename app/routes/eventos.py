import logging
from fastapi import APIRouter, HTTPException, Depends, Query
from sqlalchemy.orm import Session
from slugify import slugify

from app.models import Evento, Usuario, get_db
from app.schemas.evento import AtualizarEventoRequest, CriarEventoRequest, EventoResponse
from app.routes.auth import get_usuario_atual, get_usuario_atual_opcional

logger = logging.getLogger(__name__)
router = APIRouter()


def _slug_unico(db: Session, nome: str) -> str:
    base = slugify(nome) or "evento"
    slug = base
    n = 1
    while db.query(Evento).filter(Evento.slug == slug).first():
        slug = f"{base}-{n}"
        n += 1
    return slug

@router.post("/criar", response_model=EventoResponse)
async def criar_evento(
    evento_data: CriarEventoRequest,
    usuario_atual: Usuario = Depends(get_usuario_atual),
    db: Session = Depends(get_db)
):
    """Cria novo evento"""

    logger.info(f"Criando evento: {evento_data.nome} pelo usuário {usuario_atual.id}")

    if usuario_atual.tipo != "organizador":
        raise HTTPException(status_code=403, detail="Apenas organizadores podem criar eventos")

    slug = _slug_unico(db, evento_data.nome)
    novo_evento = Evento(
        nome=evento_data.nome,
        descricao=evento_data.descricao,
        data_inicio=evento_data.data_inicio,
        data_fim=evento_data.data_fim,
        local=evento_data.local,
        imagem_url=evento_data.imagem_url,
        preco_ingresso=evento_data.preco_ingresso,
        categoria=evento_data.categoria.strip() or "Outros",
        mensagem_confirmacao=evento_data.mensagem_confirmacao,
        organizador_id=usuario_atual.id,
        stripe_account_id=usuario_atual.stripe_account_id,
        slug=slug,
        publicado=evento_data.publicado,
    )

    db.add(novo_evento)
    db.commit()
    db.refresh(novo_evento)

    logger.info(f"Evento criado: {novo_evento.id} (slug: {novo_evento.slug})")

    return EventoResponse.model_validate(novo_evento)


@router.patch("/id/{evento_id}", response_model=EventoResponse)
async def atualizar_evento(
    evento_id: str,
    body: AtualizarEventoRequest,
    usuario_atual: Usuario = Depends(get_usuario_atual),
    db: Session = Depends(get_db),
):
    """Atualiza dados do evento. Apenas o organizador dono. O slug (URL) não muda."""

    if usuario_atual.tipo != "organizador":
        raise HTTPException(status_code=403, detail="Apenas organizadores podem editar eventos")

    evento = db.get(Evento, evento_id)
    if not evento:
        raise HTTPException(status_code=404, detail="Evento não encontrado")
    if evento.organizador_id != usuario_atual.id:
        raise HTTPException(status_code=403, detail="Sem permissão para editar este evento")

    evento.nome = body.nome
    evento.descricao = body.descricao
    evento.data_inicio = body.data_inicio
    evento.data_fim = body.data_fim
    evento.local = body.local
    evento.imagem_url = body.imagem_url
    evento.preco_ingresso = body.preco_ingresso
    evento.categoria = body.categoria.strip() or "Outros"
    evento.mensagem_confirmacao = body.mensagem_confirmacao
    evento.publicado = body.publicado

    if evento.data_fim < evento.data_inicio:
        raise HTTPException(
            status_code=400,
            detail="data_fim deve ser posterior ou igual a data_inicio",
        )

    db.commit()
    db.refresh(evento)
    logger.info("Evento %s atualizado por %s", evento.id, usuario_atual.id)
    return EventoResponse.model_validate(evento)


@router.get("/meus", response_model=list[EventoResponse])
async def listar_meus_eventos(
    usuario_atual: Usuario = Depends(get_usuario_atual),
    db: Session = Depends(get_db),
    limit: int = Query(100, ge=1, le=200),
):
    """Lista eventos criados pelo organizador autenticado (publicados e pausados)."""

    if usuario_atual.tipo != "organizador":
        raise HTTPException(status_code=403, detail="Apenas organizadores possuem eventos próprios")

    eventos = (
        db.query(Evento)
        .filter(Evento.organizador_id == usuario_atual.id)
        .order_by(Evento.data_criacao.desc())
        .limit(limit)
        .all()
    )
    return [EventoResponse.model_validate(e) for e in eventos]


@router.get("/{slug}", response_model=EventoResponse)
async def obter_evento(
    slug: str,
    db: Session = Depends(get_db),
    usuario: Usuario | None = Depends(get_usuario_atual_opcional),
):
    """Obtém evento pelo slug. Evento pausado só é visível para o organizador autenticado."""

    evento = db.query(Evento).filter(Evento.slug == slug).first()

    if not evento:
        raise HTTPException(status_code=404, detail="Evento não encontrado")

    if not evento.publicado:
        if not usuario or usuario.id != evento.organizador_id:
            raise HTTPException(status_code=404, detail="Evento não encontrado")

    return EventoResponse.model_validate(evento)

@router.get("/", response_model=list[EventoResponse])
async def listar_eventos(
    skip: int = Query(0, ge=0),
    limit: int = Query(10, ge=1, le=100),
    db: Session = Depends(get_db)
):
    """Lista todos os eventos com paginação"""
    try:
        eventos = (
            db.query(Evento)
            .filter(Evento.publicado.is_(True))
            .order_by(Evento.data_criacao.desc())
            .offset(skip)
            .limit(limit)
            .all()
        )
        return [EventoResponse.model_validate(e) for e in eventos]
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erro ao listar eventos: {str(e)}")
