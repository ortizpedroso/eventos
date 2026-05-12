from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session

from app.models import Ingresso, Usuario, get_db
from app.routes.auth import get_usuario_atual

router = APIRouter()

@router.get("/meus")
async def listar_meus_ingressos(
    usuario_atual: Usuario = Depends(get_usuario_atual),
    db: Session = Depends(get_db)
):
    """Lista ingressos do usuário"""

    ingressos = db.query(Ingresso).filter(
        Ingresso.usuario_id == usuario_atual.id
    ).all()

    return [
        {
            "id": ingresso.id,
            "evento": {
                "nome": ingresso.evento.nome,
                "data": ingresso.evento.data_inicio,
                "data_fim": ingresso.evento.data_fim,
                "local": ingresso.evento.local,
            },
            "participante_nome": ingresso.participante_nome,
            "participante_email": ingresso.participante_email,
            "valor": ingresso.valor,
            "status": ingresso.status,
            "data_compra": ingresso.data_compra,
        }
        for ingresso in ingressos
    ]
