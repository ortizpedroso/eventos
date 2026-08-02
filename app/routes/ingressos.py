from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import HTMLResponse, Response
from sqlalchemy.orm import Session
from sqlalchemy import desc
from pydantic import BaseModel, EmailStr, field_validator
from typing import Optional
import re

from app.models import Ingresso, Usuario, Evento, get_db
from app.routes.auth import get_usuario_atual
from app.deps.rate_limit import rate_limit_ingresso_vincular
from app.services.ingresso_checkin import codigo_checkin
from app.services.ingresso_qr import gerar_qr_png_bytes, ingresso_qr_payload, montar_carteirinha_ingresso_bytes
from app.services.ticket_email import enqueue_ticket_email
from app.utils.cpf import cpf_valido
from app.utils.html_escape import esc
from app.utils.privacy import mask_cpf, mask_telefone_br

router = APIRouter()


@router.get("/qr-preview")
async def qr_preview_publico(c: str, db: Session = Depends(get_db)):
    """Dados públicos mínimos do ingresso para a tela /ingresso/qr (código EBR1 assinado)."""
    from app.services.ingresso_checkin import extrair_ingresso_id

    ingresso_id = extrair_ingresso_id(c)
    if not ingresso_id:
        raise HTTPException(status_code=404, detail="Código inválido ou expirado")

    ingresso = (
        db.query(Ingresso)
        .join(Evento)
        .filter(Ingresso.id == ingresso_id)
        .first()
    )
    if not ingresso:
        raise HTTPException(status_code=404, detail="Ingresso não encontrado")

    status = (ingresso.status or "").lower()
    if status not in ("pago", "usado"):
        raise HTTPException(status_code=404, detail="Ingresso ainda não confirmado")

    ev = ingresso.evento
    return {
        "codigo": ingresso_qr_payload(ingresso.id),
        "status": ingresso.status,
        "evento": {
            "nome": ev.nome,
            "data": ev.data_inicio.isoformat() if ev.data_inicio else None,
            "local": ev.local,
        },
        "participante_nome": ingresso.participante_nome,
        "assento": getattr(ingresso, "assento", None) or None,
    }


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
            "assento": getattr(ingresso, "assento", None) or None,
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


class VincularIngressoRequest(BaseModel):
    codigo: str

    @field_validator("codigo")
    @classmethod
    def _codigo_nao_vazio(cls, v: str) -> str:
        c = (v or "").strip()
        if not c:
            raise ValueError("Informe o código do ingresso.")
        if len(c) > 500:
            raise ValueError("Código inválido.")
        return c


@router.post("/vincular")
async def vincular_ingresso(
    body: VincularIngressoRequest,
    request: Request,
    usuario_atual: Usuario = Depends(get_usuario_atual),
    db: Session = Depends(get_db),
):
    """Vincula ingresso confirmado à conta logada (código da carteirinha + e-mail igual ao da compra)."""
    from app.services.ingresso_vincular import vincular_ingresso_a_conta

    rate_limit_ingresso_vincular(request)
    try:
        ingresso, ja_vinculado = vincular_ingresso_a_conta(
            db,
            usuario=usuario_atual,
            codigo=body.codigo,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    ev = ingresso.evento
    return {
        "ingresso_id": ingresso.id,
        "evento_nome": ev.nome,
        "ja_vinculado": ja_vinculado,
        "message": (
            "Este ingresso já estava na sua conta."
            if ja_vinculado
            else f"Ingresso vinculado: {ev.nome}."
        ),
    }


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

    carteirinha_b64 = ""
    if (ingresso.status or "").lower() in ("pago", "usado"):
        import base64

        carteirinha_b64 = base64.b64encode(montar_carteirinha_ingresso_bytes(ingresso)).decode("ascii")

    carteirinha_block = ""
    if carteirinha_b64:
        codigo_txt = esc(ingresso_qr_payload(ingresso.id))
        codigo_portaria = (
            f'<p style="text-align:center;margin:16px 0 0;font-size:14px;color:#18181b">'
            f"<strong>Código para digitar na portaria</strong><br/>"
            f'<span style="display:inline-block;margin-top:8px;padding:10px 12px;background:#fff;border:1px solid #d4d4d8;border-radius:8px;'
            f'font-family:monospace;font-size:13px;font-weight:600;color:#18181b;word-break:break-all">{codigo_txt}</span></p>'
        )
        carteirinha_block = (
            f'<div style="text-align:center;margin:0 auto;max-width:480px">'
            f'<img src="data:image/png;base64,{carteirinha_b64}" alt="Carteirinha do ingresso" '
            f'style="display:block;margin:0 auto;max-width:100%;height:auto;border-radius:8px;border:1px solid #e4e4e7"/>'
            f"{codigo_portaria}"
            f'<p style="margin:10px 0 0;font-size:12px;color:#71717a">'
            f"Apresente esta carteirinha (ou o código acima) na entrada do evento.</p>"
            f"</div>"
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

    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8"/>
        <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'; script-src 'unsafe-inline';"/>
        <title>Ingresso - {ev_nome}</title>
        <style>
            body {{ font-family: sans-serif; padding: 40px; color: #333; background: #fff; }}
            .print-shell {{ max-width: 520px; margin: 0 auto; }}
            @media print {{
                body {{ padding: 0; }}
                .no-print {{ display: none; }}
            }}
        </style>
    </head>
    <body>
        <div class="no-print" style="text-align: center; margin-bottom: 24px;">
            <button type="button" id="btn-imprimir" style="padding: 12px 24px; font-size: 16px; cursor: pointer; background-color: #10b981; color: white; border: none; border-radius: 8px; font-weight: bold;">
                Imprimir ou Salvar como PDF
            </button>
        </div>
        <div class="print-shell">
            {carteirinha_block}
            {repasse_block}
        </div>
        <script>
          (function () {{
            function imprimir() {{ window.print(); }}
            var btn = document.getElementById("btn-imprimir");
            if (btn) btn.addEventListener("click", imprimir);
            window.addEventListener("load", function () {{
              window.setTimeout(imprimir, 400);
            }});
          }})();
        </script>
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


@router.get("/{ingresso_id}/carteirinha")
async def carteirinha_ingresso(
    ingresso_id: str,
    usuario_atual: Usuario = Depends(get_usuario_atual),
    db: Session = Depends(get_db),
):
    """PNG da carteirinha do ingresso — mesma imagem enviada por e-mail (nome,
    evento, data, local e QR numa imagem só), usada pra exibição/impressão na conta."""
    ingresso = db.query(Ingresso).filter(
        Ingresso.id == ingresso_id,
        Ingresso.usuario_id == usuario_atual.id,
    ).first()
    if not ingresso:
        raise HTTPException(status_code=404, detail="Ingresso não encontrado")
    if (ingresso.status or "").lower() not in ("pago", "usado"):
        raise HTTPException(
            status_code=400,
            detail="Carteirinha disponível apenas para ingressos confirmados (pagos ou já utilizados na entrada).",
        )
    return Response(content=montar_carteirinha_ingresso_bytes(ingresso), media_type="image/png")


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
