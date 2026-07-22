import logging
from datetime import datetime

from fastapi import APIRouter, HTTPException, Depends, Query, Response
from sqlalchemy.orm import Session, selectinload
from sqlalchemy import or_
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
from app.services.evento_portaria import (
    garantir_checkin_token,
    gerar_checkin_token,
    regenerar_checkin_token,
    url_portaria,
)
from app.services.evento_vitrine import evento_parece_teste
from app.utils.evento_cidade import resolver_cidade
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
        cidade=resolver_cidade(evento_data.cidade, evento_data.local),
        imagem_url=evento_data.imagem_url,
        preco_ingresso=evento_data.preco_ingresso,
        categoria=evento_data.categoria.strip() or "Outros",
        mensagem_confirmacao=evento_data.mensagem_confirmacao,
        organizador_id=usuario_atual.id,
        asaas_wallet_id=usuario_atual.asaas_wallet_id,
        slug=slug,
        publicado=evento_data.publicado,
        limite_ingressos_por_cpf=evento_data.limite_ingressos_por_cpf,
        urgencia_modo=evento_data.urgencia_modo,
        parcelamento_habilitado=evento_data.parcelamento_habilitado,
        parcelamento_max=evento_data.parcelamento_max,
        repasse_parcelamento=evento_data.repasse_parcelamento,
        aceita_interesse=evento_data.aceita_interesse,
        lista_espera_habilitada=evento_data.lista_espera_habilitada,
        lista_espera_prazo_horas=evento_data.lista_espera_prazo_horas,
        checkin_token=gerar_checkin_token(),
    )

    db.add(novo_evento)
    db.flush()

    if evento_data.ingresso_lotes:
        itens = [l.model_dump() for l in evento_data.ingresso_lotes]
        substituir_lotes_evento(db, novo_evento, itens)
    else:
        criar_lotes_iniciais(db, novo_evento, float(evento_data.preco_ingresso))

    from app.services.evento_repasse import validar_publicacao_evento_pago
    from app.services.organizador_asaas import atualizar_status_repasse_organizador

    usuario_atual = atualizar_status_repasse_organizador(db, usuario_atual)
    validar_publicacao_evento_pago(db, usuario_atual, novo_evento, evento_data.publicado)

    db.commit()
    db.refresh(novo_evento)

    logger.info(f"Evento criado: {novo_evento.id} (slug: {novo_evento.slug})")

    from app.services.ingresso_lotes import evento_tem_venda_aberta
    from app.services.lista_interesse import deve_notificar_abertura, notificar_abertura_vendas

    if deve_notificar_abertura(
        novo_evento,
        era_publicado=False,
        tinha_venda_aberta=False,
        tem_venda_aberta=evento_tem_venda_aberta(db, novo_evento),
    ):
        notificar_abertura_vendas(db, novo_evento)

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

    era_publicado = evento.publicado
    from app.services.ingresso_lotes import evento_tem_venda_aberta

    tinha_venda_aberta = evento_tem_venda_aberta(db, evento) if era_publicado else False

    evento.nome = body.nome
    evento.descricao = body.descricao
    evento.data_inicio = body.data_inicio
    evento.data_fim = body.data_fim or body.data_inicio
    evento.local = body.local
    evento.cidade = resolver_cidade(body.cidade, body.local)
    evento.imagem_url = body.imagem_url
    evento.preco_ingresso = body.preco_ingresso
    evento.categoria = body.categoria.strip() or "Outros"
    evento.mensagem_confirmacao = body.mensagem_confirmacao
    if body.publicado is not None:
        evento.publicado = body.publicado
    if "limite_ingressos_por_cpf" in body.model_fields_set:
        evento.limite_ingressos_por_cpf = body.limite_ingressos_por_cpf

    if "urgencia_modo" in body.model_fields_set:
        evento.urgencia_modo = body.urgencia_modo
    if "parcelamento_habilitado" in body.model_fields_set:
        evento.parcelamento_habilitado = body.parcelamento_habilitado
    if "parcelamento_max" in body.model_fields_set:
        evento.parcelamento_max = body.parcelamento_max
    if "repasse_parcelamento" in body.model_fields_set:
        evento.repasse_parcelamento = body.repasse_parcelamento
    if "aceita_interesse" in body.model_fields_set:
        evento.aceita_interesse = body.aceita_interesse
    if "lista_espera_habilitada" in body.model_fields_set:
        desabilitou_espera = evento.lista_espera_habilitada and not body.lista_espera_habilitada
        evento.lista_espera_habilitada = body.lista_espera_habilitada
        if desabilitou_espera:
            from app.services.lista_espera import expirar_janelas_espera_ativas

            expirar_janelas_espera_ativas(db, evento.id)
    if "lista_espera_prazo_horas" in body.model_fields_set:
        evento.lista_espera_prazo_horas = body.lista_espera_prazo_horas

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

    from app.services.evento_repasse import validar_publicacao_evento_pago
    from app.services.organizador_asaas import atualizar_status_repasse_organizador

    usuario_atual = atualizar_status_repasse_organizador(db, usuario_atual)
    if body.publicado is not None:
        validar_publicacao_evento_pago(db, usuario_atual, evento, body.publicado)

    db.commit()
    db.refresh(evento)
    logger.info("Evento %s atualizado por %s", evento.id, usuario_atual.id)

    from app.services.lista_interesse import deve_notificar_abertura, notificar_abertura_vendas

    tem_venda_aberta = evento_tem_venda_aberta(db, evento)
    if deve_notificar_abertura(
        evento,
        era_publicado=era_publicado,
        tinha_venda_aberta=tinha_venda_aberta,
        tem_venda_aberta=tem_venda_aberta,
    ):
        notificar_abertura_vendas(db, evento)

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


@router.get("/stats-publicas")
async def stats_publicas(db: Session = Depends(get_db)):
    """Números agregados para prova social na home."""
    from sqlalchemy import func

    from app.models import Ingresso

    eventos = db.query(func.count(Evento.id)).filter(Evento.publicado.is_(True)).scalar() or 0
    ingressos = (
        db.query(func.count(Ingresso.id)).filter(Ingresso.status.in_(("pago", "usado"))).scalar() or 0
    )
    return {"eventos_publicados": int(eventos), "ingressos_confirmados": int(ingressos)}


@router.get("/cidades")
async def listar_cidades_eventos(
    db: Session = Depends(get_db),
    limit: int = Query(80, ge=1, le=200),
):
    """Cidades com eventos publicados (para filtro na vitrine)."""
    from sqlalchemy import func

    rows = (
        db.query(Evento.cidade, func.count(Evento.id))
        .filter(Evento.publicado.is_(True), Evento.cidade.isnot(None), Evento.cidade != "")
        .group_by(Evento.cidade)
        .order_by(func.count(Evento.id).desc(), Evento.cidade.asc())
        .limit(limit)
        .all()
    )
    return [{"cidade": r[0], "total": int(r[1])} for r in rows if r[0]]


@router.get("", response_model=list[EventoResponse])
async def listar_eventos(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=100),
    q: str | None = Query(None, max_length=100, description="Busca por nome, descrição ou local"),
    categoria: str | None = Query(None, max_length=80),
    cidade: str | None = Query(None, max_length=120),
    de: datetime | None = Query(None, description="Data início mínima (inclusive)"),
    ate: datetime | None = Query(None, description="Data início máxima (inclusive)"),
    db: Session = Depends(get_db),
):
    """Lista eventos publicados na vitrine."""
    try:
        query = (
            db.query(Evento)
            .options(selectinload(Evento.ingresso_lotes))
            .filter(Evento.publicado.is_(True))
        )
        if q:
            termo = f"%{q.strip()}%"
            query = query.filter(
                or_(
                    Evento.nome.ilike(termo),
                    Evento.descricao.ilike(termo),
                    Evento.local.ilike(termo),
                )
            )
        if categoria:
            query = query.filter(Evento.categoria == categoria.strip())
        if cidade:
            query = query.filter(Evento.cidade.ilike(cidade.strip()))
        if de is not None:
            query = query.filter(Evento.data_inicio >= de)
        if ate is not None:
            query = query.filter(Evento.data_inicio <= ate)

        eventos = (
            query.order_by(Evento.data_inicio.asc())
            .offset(skip)
            .limit(limit)
            .all()
        )
        eventos = [
            e
            for e in eventos
            if not evento_parece_teste(nome=e.nome, local=e.local, slug=e.slug or "")
        ]
        return _montar_lista_eventos(db, eventos)
    except Exception:
        logger.exception("Erro inesperado ao listar eventos públicos")
        raise HTTPException(status_code=500, detail=LISTA_EVENTOS_CLIENTE)


@router.get("/{slug}/relacionados", response_model=list[EventoResponse])
async def eventos_relacionados(slug: str, db: Session = Depends(get_db)):
    """Até 4 eventos relacionados (organizador, depois cidade+categoria)."""
    from app.services.eventos_relacionados import listar_eventos_relacionados

    evento = (
        db.query(Evento)
        .options(selectinload(Evento.ingresso_lotes))
        .filter(Evento.slug == slug, Evento.publicado.is_(True))
        .first()
    )
    if not evento:
        raise HTTPException(status_code=404, detail="Evento não encontrado")
    return listar_eventos_relacionados(db, evento)


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


def _evento_do_organizador(db: Session, evento_id: str, usuario: Usuario) -> Evento:
    if usuario.tipo != "organizador":
        raise HTTPException(status_code=403, detail="Apenas organizadores")
    evento = db.get(Evento, evento_id)
    if not evento or evento.organizador_id != usuario.id:
        raise HTTPException(status_code=404, detail="Evento não encontrado")
    return evento


@router.get("/id/{evento_id}/lista-interesse")
async def listar_lista_interesse(
    evento_id: str,
    usuario_atual: Usuario = Depends(get_usuario_atual),
    db: Session = Depends(get_db),
):
    """Inscritos na lista de interesse (organizador)."""
    from app.services.lista_interesse import listar_interesse

    evento = _evento_do_organizador(db, evento_id, usuario_atual)
    rows = listar_interesse(db, evento.id)
    return [
        {
            "email": r.email,
            "nome": r.nome,
            "data_criacao": r.data_criacao.isoformat() if r.data_criacao else None,
        }
        for r in rows
    ]


@router.get("/id/{evento_id}/lista-interesse/export")
async def exportar_lista_interesse(
    evento_id: str,
    usuario_atual: Usuario = Depends(get_usuario_atual),
    db: Session = Depends(get_db),
):
    """CSV de inscritos na lista de interesse."""
    from app.services.lista_interesse import exportar_interesse_csv

    evento = _evento_do_organizador(db, evento_id, usuario_atual)
    csv_data = exportar_interesse_csv(db, evento.id)
    return Response(
        content=csv_data,
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="interesse-{evento.slug}.csv"'},
    )


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
        "token_em": evento.checkin_token_em.isoformat() if evento.checkin_token_em else None,
    }


@router.post("/id/{evento_id}/link-portaria/regenerar")
async def regenerar_link_portaria(
    evento_id: str,
    usuario_atual: Usuario = Depends(get_usuario_atual),
    db: Session = Depends(get_db),
):
    """Invalida o link anterior e gera um novo (se vazou o link antigo)."""
    evento = _evento_do_organizador(db, evento_id, usuario_atual)
    token = regenerar_checkin_token(db, evento)
    return {
        "evento_id": evento.id,
        "evento_nome": evento.nome,
        "token": token,
        "url": url_portaria(evento.id, token),
        "token_em": evento.checkin_token_em.isoformat() if evento.checkin_token_em else None,
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


@router.get("/id/{evento_id}/resumo")
async def resumo_evento_organizador(
    evento_id: str,
    usuario_atual: Usuario = Depends(get_usuario_atual),
    db: Session = Depends(get_db),
):
    """Indicadores simples para o painel do organizador."""
    from sqlalchemy import func

    from app.models import Ingresso

    evento = (
        db.query(Evento)
        .options(selectinload(Evento.ingresso_lotes))
        .filter(Evento.id == evento_id, Evento.organizador_id == usuario_atual.id)
        .first()
    )
    if not evento:
        raise HTTPException(status_code=404, detail="Evento não encontrado")

    rows = (
        db.query(Ingresso.status, func.count(Ingresso.id))
        .filter(Ingresso.evento_id == evento_id)
        .group_by(Ingresso.status)
        .all()
    )
    por_status = {str(s): int(c) for s, c in rows}
    pagos = por_status.get("pago", 0) + por_status.get("usado", 0)
    pendentes = por_status.get("pendente", 0)
    checkins = por_status.get("usado", 0)

    receita = (
        db.query(func.coalesce(func.sum(Ingresso.valor), 0))
        .filter(Ingresso.evento_id == evento_id, Ingresso.status.in_(("pago", "usado")))
        .scalar()
    )

    return {
        "evento_id": evento.id,
        "publicado": evento.publicado,
        "ingressos_pagos": pagos,
        "ingressos_pendentes": pendentes,
        "checkins_realizados": checkins,
        "receita_bruta": float(receita or 0),
        "lotes_ativos": sum(1 for l in evento.ingresso_lotes if l.ativo),
        "tem_link_portaria": bool(evento.checkin_token),
    }


@router.post("/id/{evento_id}/duplicar", response_model=EventoResponse)
async def duplicar_evento(
    evento_id: str,
    usuario_atual: Usuario = Depends(get_usuario_atual),
    db: Session = Depends(get_db),
):
    """Cria cópia do evento (pausada) com os mesmos lotes."""
    from app.models import EventoIngressoLote

    evento = (
        db.query(Evento)
        .options(selectinload(Evento.ingresso_lotes))
        .filter(Evento.id == evento_id, Evento.organizador_id == usuario_atual.id)
        .first()
    )
    if not evento:
        raise HTTPException(status_code=404, detail="Evento não encontrado")
    slug = _slug_unico(db, f"{evento.nome} copia")
    copia = Evento(
        nome=f"{evento.nome} (cópia)",
        descricao=evento.descricao,
        data_inicio=evento.data_inicio,
        data_fim=evento.data_fim,
        local=evento.local,
        cidade=evento.cidade,
        imagem_url=evento.imagem_url,
        preco_ingresso=evento.preco_ingresso,
        categoria=evento.categoria,
        mensagem_confirmacao=evento.mensagem_confirmacao,
        organizador_id=usuario_atual.id,
        asaas_wallet_id=usuario_atual.asaas_wallet_id,
        slug=slug,
        publicado=False,
        limite_ingressos_por_cpf=evento.limite_ingressos_por_cpf,
        urgencia_modo=getattr(evento, "urgencia_modo", "desligado"),
        parcelamento_habilitado=getattr(evento, "parcelamento_habilitado", False),
        parcelamento_max=getattr(evento, "parcelamento_max", 2),
        repasse_parcelamento=getattr(evento, "repasse_parcelamento", "comprador") or "comprador",
        aceita_interesse=getattr(evento, "aceita_interesse", True),
        lista_espera_habilitada=getattr(evento, "lista_espera_habilitada", False),
        lista_espera_prazo_horas=getattr(evento, "lista_espera_prazo_horas", 24),
        checkin_token=gerar_checkin_token(),
    )
    db.add(copia)
    db.flush()

    for lote in sorted(evento.ingresso_lotes, key=lambda x: (x.ordem, x.id)):
        db.add(
            EventoIngressoLote(
                evento_id=copia.id,
                nome=lote.nome,
                tipo=getattr(lote, "tipo", "padrao") or "padrao",
                preco=lote.preco,
                ordem=lote.ordem,
                quantidade_maxima=lote.quantidade_maxima,
                ativo=lote.ativo,
                vendas_inicio=lote.vendas_inicio,
                vendas_fim=lote.vendas_fim,
            )
        )

    db.commit()
    db.refresh(copia)
    logger.info("Evento %s duplicado como %s por %s", evento.id, copia.id, usuario_atual.id)
    return montar_evento_response(db, copia)
