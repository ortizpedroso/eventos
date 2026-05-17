from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import HTMLResponse, Response
from sqlalchemy.orm import Session
from sqlalchemy import desc
from pydantic import BaseModel
from typing import Optional

from app.models import Ingresso, Usuario, Evento, get_db
from app.routes.auth import get_usuario_atual
from app.services.ingresso_qr import gerar_qr_png_bytes
from app.services.ticket_email import enqueue_ticket_email
from app.utils.privacy import mask_cpf, mask_telefone_br

router = APIRouter()

@router.get("/meus")
async def listar_meus_ingressos(
    usuario_atual: Usuario = Depends(get_usuario_atual),
    db: Session = Depends(get_db)
):
    """Lista ingressos do usuário"""

    ingressos = db.query(Ingresso).join(Evento).filter(
        Ingresso.usuario_id == usuario_atual.id
    ).order_by(desc(Evento.data_inicio)).all()

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
            "participante_cpf": mask_cpf(ingresso.participante_cpf),
            "participante_telefone": mask_telefone_br(ingresso.participante_telefone),
            "valor": ingresso.valor,
            "status": ingresso.status,
            "data_compra": ingresso.data_compra,
        }
        for ingresso in ingressos
    ]

class EmailRequest(BaseModel):
    email: Optional[str] = None

@router.get("/{ingresso_id}/download", response_class=HTMLResponse)
async def download_ingresso(
    ingresso_id: str,
    usuario_atual: Usuario = Depends(get_usuario_atual),
    db: Session = Depends(get_db)
):
    """Gera um HTML amigável para impressão/PDF do ingresso"""
    ingresso = db.query(Ingresso).filter(
        Ingresso.id == ingresso_id,
        Ingresso.usuario_id == usuario_atual.id
    ).first()

    if not ingresso:
        raise HTTPException(status_code=404, detail="Ingresso não encontrado")

    qr_b64 = ""
    if ingresso.status == "pago":
        import base64

        qr_b64 = base64.b64encode(gerar_qr_png_bytes(ingresso.id)).decode("ascii")

    qr_block = (
        f'<p style="text-align:center;margin:16px 0"><img src="data:image/png;base64,{qr_b64}" width="180" height="180" alt="QR Code"/></p>'
        if qr_b64
        else ""
    )

    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <title>Ingresso - {ingresso.evento.nome}</title>
        <style>
            body {{ font-family: sans-serif; padding: 40px; color: #333; }}
            .ticket {{ border: 2px dashed #10b981; padding: 30px; max-width: 600px; margin: 0 auto; border-radius: 12px; }}
            .header {{ text-align: center; border-bottom: 2px solid #eee; padding-bottom: 20px; margin-bottom: 20px; }}
            .header h2 {{ margin: 0; color: #047857; }}
            .details p {{ margin: 10px 0; font-size: 16px; }}
            .status {{ display: inline-block; padding: 4px 12px; background: #d1fae5; color: #047857; border-radius: 999px; font-weight: bold; font-size: 14px; margin-top: 15px; }}
            @media print {{
                body {{ padding: 0; }}
                .no-print {{ display: none; }}
            }}
        </style>
    </head>
    <body>
        <div class="no-print" style="text-align: center; margin-bottom: 30px;">
            <button onclick="window.print()" style="padding: 12px 24px; font-size: 16px; cursor: pointer; background-color: #10b981; color: white; border: none; border-radius: 8px; font-weight: bold;">
                Imprimir ou Salvar como PDF
            </button>
        </div>
        <div class="ticket">
            <div class="header">
                <h2>{ingresso.evento.nome}</h2>
                <p style="margin-top: 5px; color: #666;">Ingresso Oficial</p>
            </div>
            <div class="details">
                <p><strong>Participante:</strong> {ingresso.participante_nome}</p>
                <p><strong>Email:</strong> {ingresso.participante_email}</p>
                <p><strong>Data:</strong> {ingresso.evento.data_inicio}</p>
                <p><strong>Local:</strong> {ingresso.evento.local}</p>
                {qr_block}
                <p><strong>Código do Ingresso:</strong> {ingresso.id}</p>
                <div class="status">{ingresso.status.upper()}</div>
            </div>
        </div>
    </body>
    </html>
    """
    return HTMLResponse(content=html_content)

@router.get("/{ingresso_id}/qr")
async def qr_ingresso(
    ingresso_id: str,
    usuario_atual: Usuario = Depends(get_usuario_atual),
    db: Session = Depends(get_db),
):
    """PNG do QR Code do ingresso (apenas pago)."""
    ingresso = db.query(Ingresso).filter(
        Ingresso.id == ingresso_id,
        Ingresso.usuario_id == usuario_atual.id,
    ).first()
    if not ingresso:
        raise HTTPException(status_code=404, detail="Ingresso não encontrado")
    if ingresso.status != "pago":
        raise HTTPException(status_code=400, detail="QR disponível apenas para ingressos pagos")
    return Response(content=gerar_qr_png_bytes(ingresso.id), media_type="image/png")


@router.post("/{ingresso_id}/enviar-email")
async def enviar_email_ingresso(
    ingresso_id: str,
    request: EmailRequest,
    usuario_atual: Usuario = Depends(get_usuario_atual),
    db: Session = Depends(get_db)
):
    """Endpoint para enviar o ingresso por email."""
    ingresso = db.query(Ingresso).filter(
        Ingresso.id == ingresso_id,
        Ingresso.usuario_id == usuario_atual.id
    ).first()

    if not ingresso:
        raise HTTPException(status_code=404, detail="Ingresso não encontrado")

    if ingresso.status != "pago":
        raise HTTPException(status_code=400, detail="Ingresso ainda não está pago")

    email_destino = (request.email or ingresso.participante_email or usuario_atual.email).strip()
    enqueue_ticket_email(ingresso.id)

    return {"message": f"Ingresso enviado para {email_destino} (verifique também o spam)."}
