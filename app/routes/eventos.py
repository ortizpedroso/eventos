import logging
from fastapi import APIRouter, HTTPException, Depends, Query
from sqlalchemy.orm import Session, selectinload
from slugify import slugify

from app.models import Evento, EventoCupom, Usuario, get_db
from app.schemas.cupom import CupomResponse, CupomWrite
from app.schemas.evento import AtualizarEventoRequest, CriarEventoRequest, EventoResponse, montar_evento_response
from app.routes.auth import get_usuario_atual, get_usuario_atual_opcional
from app.services.ingresso_lotes import (
    contar_ocupacao_por_lotes,
    criar_lotes_iniciais,
    sincronizar_preco_ingresso_evento,
    substituir_lotes_evento,
)
from app.services.evento_portaria import garantir_checkin_token, gerar_checkin_token, url_portaria
from app.utils.public_errors import LISTA_EVENTOS_CLIENTE

logger = logging.getLogger(__name__)
router = APIRouter()


def _montar_lista_eventos(db: Session, eventos: list[Evento]) -> list[EventoResponse]:
    lote_ids = [l.id for e in eventos for l in e.ingresso_lotes]
    occ = contar_ocupacao_por_lotes(db, lote_ids)
    return [montar_evento_response(db, e, ocupacao_por_lote=occ) for e in eventos]


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
        data_fim=evento_data.data_fim or evento_data.data_inicio,
        local=evento_data.local,
        imagem_url=evento_data.imagem_url,
        preco_ingresso=evento_data.preco_ingresso,
        categoria=evento_data.categoria.strip() or "Outros",
        mensagem_confirmacao=evento_data.mensagem_confirmacao,
        organizador_id=usuario_atual.id,
        stripe_account_id=usuario_atual.stripe_account_id,
        slug=slug,
        publicado=evento_data.publicado,
        limite_ingressos_por_cpf=evento_data.limite_ingressos_por_cpf,
        checkin_token=gerar_checkin_token(),
    )

    db.add(novo_evento)
    db.flush()

    if evento_data.ingresso_lotes:
        itens = [l.model_dump() for l in evento_data.ingresso_lotes]
        substituir_lotes_evento(db, novo_evento, itens)
    else:
        criar_lotes_iniciais(db, novo_evento, float(evento_data.preco_ingresso))

    db.commit()
    db.refresh(novo_evento)

    logger.info(f"Evento criado: {novo_evento.id} (slug: {novo_evento.slug})")

    return montar_evento_response(db, novo_evento)


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
    evento.data_fim = body.data_fim or body.data_inicio
    evento.local = body.local
    evento.imagem_url = body.imagem_url
    evento.preco_ingresso = body.preco_ingresso
    evento.categoria = body.categoria.strip() or "Outros"
    evento.mensagem_confirmacao = body.mensagem_confirmacao
    evento.publicado = body.publicado
    if "limite_ingressos_por_cpf" in body.model_fields_set:
        evento.limite_ingressos_por_cpf = body.limite_ingressos_por_cpf

    if evento.data_fim < evento.data_inicio:
        raise HTTPException(
            status_code=400,
            detail="data_fim deve ser posterior ou igual a data_inicio",
        )

    if "ingresso_lotes" in body.model_fields_set and body.ingresso_lotes is not None:
        try:
            itens = [l.model_dump() for l in body.ingresso_lotes]
            substituir_lotes_evento(db, evento, itens)
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e)) from e

    sincronizar_preco_ingresso_evento(db, evento)

    db.commit()
    db.refresh(evento)
    logger.info("Evento %s atualizado por %s", evento.id, usuario_atual.id)
    return montar_evento_response(db, evento)


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
        .options(selectinload(Evento.ingresso_lotes))
        .filter(Evento.organizador_id == usuario_atual.id)
        .order_by(Evento.data_criacao.desc())
        .limit(limit)
        .all()
    )
    return _montar_lista_eventos(db, eventos)


@router.get("/{slug}", response_model=EventoResponse)
async def obter_evento(
    slug: str,
    db: Session = Depends(get_db),
    usuario: Usuario | None = Depends(get_usuario_atual_opcional),
):
    """Obtém evento pelo slug. Evento pausado só é visível para o organizador autenticado."""

    evento = (
        db.query(Evento)
        .options(selectinload(Evento.ingresso_lotes))
        .filter(Evento.slug == slug)
        .first()
    )

    if not evento:
        raise HTTPException(status_code=404, detail="Evento não encontrado")

    if not evento.publicado:
        if not usuario or usuario.id != evento.organizador_id:
            raise HTTPException(status_code=404, detail="Evento não encontrado")

    return montar_evento_response(db, evento)

@router.get("", response_model=list[EventoResponse])
async def listar_eventos(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db)
):
    """Lista todos os eventos com paginação"""
    try:
        eventos = (
            db.query(Evento)
            .options(selectinload(Evento.ingresso_lotes))
            .filter(Evento.publicado.is_(True))
            .order_by(Evento.data_criacao.desc())
            .offset(skip)
            .limit(limit)
            .all()
        )
        return _montar_lista_eventos(db, eventos)
    except Exception:
        logger.exception("Erro inesperado ao listar eventos públicos")
        raise HTTPException(status_code=500, detail=LISTA_EVENTOS_CLIENTE)


def _evento_do_organizador(db: Session, evento_id: str, usuario: Usuario) -> Evento:
    if usuario.tipo != "organizador":
        raise HTTPException(status_code=403, detail="Apenas organizadores")
    evento = db.get(Evento, evento_id)
    if not evento or evento.organizador_id != usuario.id:
        raise HTTPException(status_code=404, detail="Evento não encontrado")
    return evento


@router.get("/id/{evento_id}/link-portaria")
async def link_portaria_evento(
    evento_id: str,
    usuario_atual: Usuario = Depends(get_usuario_atual),
    db: Session = Depends(get_db),
):
    """URL e token para colaboradores validarem ingressos (câmera ou digitação)."""
    evento = _evento_do_organizador(db, evento_id, usuario_atual)
    token = garantir_checkin_token(db, evento)
    return {
        "evento_id": evento.id,
        "evento_nome": evento.nome,
        "token": token,
        "url": url_portaria(evento.id, token),
    }


@router.post("/id/{evento_id}/link-portaria/regenerar")
async def regenerar_link_portaria(
    evento_id: str,
    usuario_atual: Usuario = Depends(get_usuario_atual),
    db: Session = Depends(get_db),
):
    """Invalida o link anterior e gera um novo (se vazou o link antigo)."""
    evento = _evento_do_organizador(db, evento_id, usuario_atual)
    evento.checkin_token = gerar_checkin_token()
    db.commit()
    db.refresh(evento)
    token = evento.checkin_token
    return {
        "evento_id": evento.id,
        "evento_nome": evento.nome,
        "token": token,
        "url": url_portaria(evento.id, token),
    }


@router.get("/id/{evento_id}/cupons", response_model=list[CupomResponse])
async def listar_cupons_evento(
    evento_id: str,
    usuario_atual: Usuario = Depends(get_usuario_atual),
    db: Session = Depends(get_db),
):
    _evento_do_organizador(db, evento_id, usuario_atual)
    rows = (
        db.query(EventoCupom)
        .filter(EventoCupom.evento_id == evento_id)
        .order_by(EventoCupom.codigo.asc())
        .all()
    )
    return [CupomResponse.model_validate(c) for c in rows]


@router.post("/id/{evento_id}/cupons", response_model=CupomResponse)
async def criar_cupom_evento(
    evento_id: str,
    body: CupomWrite,
    usuario_atual: Usuario = Depends(get_usuario_atual),
    db: Session = Depends(get_db),
):
    _evento_do_organizador(db, evento_id, usuario_atual)
    existe = (
        db.query(EventoCupom)
        .filter(EventoCupom.evento_id == evento_id, EventoCupom.codigo == body.codigo)
        .first()
    )
    if existe:
        raise HTTPException(status_code=400, detail="Já existe cupom com este código neste evento")
    cupom = EventoCupom(
        evento_id=evento_id,
        codigo=body.codigo,
        tipo=body.tipo,
        valor=body.valor,
        max_usos=body.max_usos,
        ativo=body.ativo,
        valido_ate=body.valido_ate,
    )
    db.add(cupom)
    db.commit()
    db.refresh(cupom)
    return CupomResponse.model_validate(cupom)


@router.delete("/id/{evento_id}/cupons/{cupom_id}")
async def remover_cupom_evento(
    evento_id: str,
    cupom_id: str,
    usuario_atual: Usuario = Depends(get_usuario_atual),
    db: Session = Depends(get_db),
):
    _evento_do_organizador(db, evento_id, usuario_atual)
    cupom = db.get(EventoCupom, cupom_id)
    if not cupom or cupom.evento_id != evento_id:
        raise HTTPException(status_code=404, detail="Cupom não encontrado")
    db.delete(cupom)
    db.commit()
    return {"ok": True}
