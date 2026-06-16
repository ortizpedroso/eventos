from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import HTMLResponse, Response
from sqlalchemy.orm import Session
from sqlalchemy import desc
from pydantic import BaseModel, EmailStr, field_validator
from typing import Optional
import re

from app.models import Ingresso, Usuario, Evento, get_db
from app.routes.auth import get_usuario_atual
from app.services.ingresso_checkin import codigo_checkin
from app.services.ingresso_qr import gerar_qr_png_bytes, ingresso_qr_payload
from app.services.ticket_email import enqueue_ticket_email
from app.utils.cpf import cpf_valido
from app.utils.html_escape import esc
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

    items = []
    for ingresso in ingressos:
        st = (ingresso.status or "").lower()
        item = {
            "id": ingresso.id,
            "evento": {
                "id": ingresso.evento.id,
                "slug": ingresso.evento.slug,
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
            "repassado_para_nome": ingresso.repassado_para_nome,
            "repassado_para_email": ingresso.repassado_para_email,
            "repassado_em": ingresso.repassado_em,
            "reservado_ate": (
                ingresso.reservado_ate.isoformat() + "Z"
                if ingresso.reservado_ate is not None
                else None
            ),
        }
        if st in ("pago", "usado"):
            item["codigo_checkin"] = codigo_checkin(ingresso.id)
        items.append(item)
    return items

class EmailRequest(BaseModel):
    pass


class RepassarIngressoRequest(BaseModel):
    nome: str
    cpf: str
    email: EmailStr
    telefone: str
    data_nascimento: str

    @field_validator("cpf")
    @classmethod
    def _validar_cpf(cls, v: str) -> str:
        digits = re.sub(r"\D", "", v)
        if len(digits) != 11:
            raise ValueError("CPF deve ter 11 dígitos")
        if not cpf_valido(digits):
            raise ValueError("CPF inválido")
        return digits

    @field_validator("data_nascimento")
    @classmethod
    def _validar_data(cls, v: str) -> str:
        try:
            datetime.strptime(v, "%Y-%m-%d")
        except ValueError:
            raise ValueError("data_nascimento deve estar no formato YYYY-MM-DD")
        return v

@router.post("/{ingresso_id}/repassar")
async def repassar_ingresso(
    ingresso_id: str,
    request: RepassarIngressoRequest,
    usuario_atual: Usuario = Depends(get_usuario_atual),
    db: Session = Depends(get_db),
):
    """Repassa (transfere) a titularidade do participante para outra pessoa."""
    ingresso = db.query(Ingresso).filter(
        Ingresso.id == ingresso_id,
        Ingresso.usuario_id == usuario_atual.id,
    ).first()

    if not ingresso:
        raise HTTPException(status_code=404, detail="Ingresso não encontrado")

    if ingresso.status != "pago":
        raise HTTPException(
            status_code=400,
            detail="Só é possível repassar ingressos com pagamento confirmado.",
        )

    ingresso.participante_nome = request.nome
    ingresso.participante_email = request.email
    ingresso.participante_cpf = re.sub(r"\D", "", request.cpf)
    ingresso.participante_telefone = request.telefone
    ingresso.repassado_para_nome = request.nome
    ingresso.repassado_para_cpf = re.sub(r"\D", "", request.cpf)
    ingresso.repassado_para_email = request.email
    ingresso.repassado_para_telefone = request.telefone
    ingresso.repassado_para_data_nascimento = request.data_nascimento
    ingresso.repassado_em = datetime.now(timezone.utc).replace(tzinfo=None)

    db.commit()
    db.refresh(ingresso)

    return {
        "id": ingresso.id,
        "repassado_para_nome": ingresso.repassado_para_nome,
        "repassado_para_email": ingresso.repassado_para_email,
        "repassado_em": ingresso.repassado_em,
        "message": f"Ingresso repassado para {ingresso.repassado_para_nome} com sucesso.",
    }


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
    if (ingresso.status or "").lower() in ("pago", "usado"):
        import base64

        qr_b64 = base64.b64encode(gerar_qr_png_bytes(ingresso.id)).decode("ascii")

    codigo_portaria = ""
    if qr_b64:
        codigo_txt = esc(ingresso_qr_payload(ingresso.id))
        codigo_portaria = (
            f'<p style="text-align:center;margin:14px 0 0;font-size:14px;color:#18181b">'
            f"<strong>Código para digitar na portaria</strong><br/>"
            f'<span style="display:inline-block;margin-top:8px;padding:10px 12px;background:#fff;border:1px solid #d4d4d8;border-radius:8px;'
            f'font-family:monospace;font-size:13px;font-weight:600;color:#18181b;word-break:break-all">{codigo_txt}</span></p>'
        )
    qr_block = (
        f'<div style="text-align:center;margin:20px 0;padding:16px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px">'
        f'<img src="data:image/png;base64,{qr_b64}" width="240" height="240" alt="QR Code do ingresso" style="display:block;margin:0 auto"/>'
        f"{codigo_portaria}"
        f'<p style="margin:10px 0 0;font-size:12px;color:#71717a">Apresente este QR ou o código na entrada do evento.</p>'
        f"</div>"
        if qr_b64
        else ""
    )

    repasse_block = ""
    if ingresso.repassado_em and ingresso.repassado_para_nome:
        data_repasse = ingresso.repassado_em.strftime("%d/%m/%Y às %H:%M")
        repasse_block = f"""
        <div style="margin:20px 0;padding:14px 18px;background:#fef3c7;border:1px solid #f59e0b;border-radius:8px;font-size:14px;color:#78350f;">
            <strong>Ingresso repassado</strong> — transferido para
            <strong>{esc(ingresso.repassado_para_nome)}</strong> em {esc(data_repasse)}.
        </div>"""

    ev_nome = esc(ingresso.evento.nome)
    part_nome = esc(ingresso.participante_nome)
    part_email = esc(ingresso.participante_email)
    ev_data = esc(ingresso.evento.data_inicio)
    ev_local = esc(ingresso.evento.local)
    status_txt = esc((ingresso.status or "").upper())

    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8"/>
        <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline';"/>
        <title>Ingresso - {ev_nome}</title>
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
                <h2>{ev_nome}</h2>
                <p style="margin-top: 5px; color: #666;">Ingresso Oficial</p>
            </div>
            <div class="details">
                {repasse_block}
                <p><strong>Participante:</strong> {part_nome}</p>
                <p><strong>Email:</strong> {part_email}</p>
                <p><strong>Data:</strong> {ev_data}</p>
                <p><strong>Local:</strong> {ev_local}</p>
                {qr_block}
                <div class="status">{status_txt}</div>
            </div>
        </div>
    </body>
    </html>
    """
    return HTMLResponse(content=html_content)

@router.get("/{ingresso_id}/codigo-checkin")
async def codigo_checkin_ingresso(
    ingresso_id: str,
    usuario_atual: Usuario = Depends(get_usuario_atual),
    db: Session = Depends(get_db),
):
    """Código EBR1 para digitar na portaria (apenas ingresso confirmado do titular)."""
    ingresso = db.query(Ingresso).filter(
        Ingresso.id == ingresso_id,
        Ingresso.usuario_id == usuario_atual.id,
    ).first()
    if not ingresso:
        raise HTTPException(status_code=404, detail="Ingresso não encontrado")
    if (ingresso.status or "").lower() not in ("pago", "usado"):
        raise HTTPException(
            status_code=400,
            detail="Código disponível apenas para ingressos confirmados (pagos ou já utilizados na entrada).",
        )
    return {"codigo_checkin": codigo_checkin(ingresso.id)}


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
    if (ingresso.status or "").lower() not in ("pago", "usado"):
        raise HTTPException(
            status_code=400,
            detail="QR disponível apenas para ingressos confirmados (pagos ou já utilizados na entrada).",
        )
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

    email_destino = (ingresso.participante_email or usuario_atual.email or "").strip()
    if not email_destino:
        raise HTTPException(status_code=400, detail="Ingresso sem e-mail de destino.")
    enqueue_ticket_email(ingresso.id)

    return {"message": f"Ingresso enfileirado para {email_destino} (verifique também o spam)."}
