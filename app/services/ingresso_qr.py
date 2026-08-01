"""QR Code único por ingresso (payload estável para check-in futuro)."""

from __future__ import annotations

import base64
import io
from typing import TYPE_CHECKING
from urllib.parse import quote

from app.services.ingresso_checkin import ingresso_qr_payload as codigo_portaria_payload
from config.settings import settings

if TYPE_CHECKING:
    from app.models import Ingresso


def ingresso_qr_payload(ingresso_id: str) -> str:
    """Código EBR1:… para digitar na portaria ou exibir no ingresso."""
    return codigo_portaria_payload(ingresso_id)


def ingresso_qr_scan_url(ingresso_id: str) -> str:
    """URL pública no QR — câmeras de celular reconhecem links (texto puro muitas vezes não)."""
    codigo = ingresso_qr_payload(ingresso_id)
    base = (settings.FRONTEND_PUBLIC_URL or "http://localhost:3000").rstrip("/")
    return f"{base}/ingresso/qr?c={quote(codigo, safe='')}"


def gerar_qr_png_bytes(ingresso_id: str) -> bytes:
    import qrcode
    from qrcode.constants import ERROR_CORRECT_H

    qr = qrcode.QRCode(
        version=None,
        error_correction=ERROR_CORRECT_H,
        box_size=10,
        border=4,
    )
    qr.add_data(ingresso_qr_scan_url(ingresso_id))
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


def gerar_qr_png_base64(ingresso_id: str) -> str:
    return base64.b64encode(gerar_qr_png_bytes(ingresso_id)).decode("ascii")


_FONTE_REGULAR = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
_FONTE_BOLD = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"


def _quebrar_linhas(draw, texto: str, fonte, largura_max: int) -> list[str]:
    """Quebra texto em linhas que cabem em largura_max pixels (word-wrap simples)."""
    palavras = texto.split()
    linhas: list[str] = []
    atual = ""
    for palavra in palavras:
        tentativa = f"{atual} {palavra}".strip()
        if draw.textlength(tentativa, font=fonte) <= largura_max:
            atual = tentativa
        else:
            if atual:
                linhas.append(atual)
            atual = palavra
    if atual:
        linhas.append(atual)
    return linhas


def gerar_ticket_card_png_bytes(
    *,
    ingresso_id: str,
    evento_nome: str,
    data_local_fmt: str,
    local: str,
    participante_nome: str,
    assento: str | None = None,
) -> bytes:
    """Carteirinha compacta pra mostrar no celular na entrada: nome, evento, data,
    local e o QR — tudo numa imagem só, pra não perder o contexto se a pessoa
    salvar/printar só a imagem do ingresso (em vez do e-mail inteiro).

    Tamanho pensado pra tela de celular: largura moderada (480px), QR grande o
    bastante pra escanear bem (280px) sem deixar o arquivo pesado."""
    from PIL import Image, ImageDraw, ImageFont

    LARGURA = 480
    MARGEM = 28
    QR_TAM = 280
    assento_txt = (assento or "").strip() or None

    fonte_titulo = ImageFont.truetype(_FONTE_BOLD, 26)
    fonte_label = ImageFont.truetype(_FONTE_REGULAR, 15)
    fonte_valor = ImageFont.truetype(_FONTE_BOLD, 18)
    fonte_rodape = ImageFont.truetype(_FONTE_REGULAR, 12)

    img_tmp = Image.new("RGB", (10, 10))
    draw_tmp = ImageDraw.Draw(img_tmp)
    linhas_titulo = _quebrar_linhas(draw_tmp, evento_nome, fonte_titulo, LARGURA - 2 * MARGEM)[:2]

    # Altura calculada dinamicamente conforme o título (1 ou 2 linhas) + assento opcional
    altura_titulo = len(linhas_titulo) * 32
    altura_assento = 40 if assento_txt else 0
    ALTURA = (
        MARGEM
        + altura_titulo
        + 16
        + 44
        + 4
        + 44
        + altura_assento
        + 20
        + QR_TAM
        + 16
        + 22
        + 20
        + 18
        + MARGEM
    )

    img = Image.new("RGB", (LARGURA, ALTURA), "white")
    draw = ImageDraw.Draw(img)

    accent = (5, 150, 105)  # emerald-600, cor da marca
    y = MARGEM

    draw.rectangle([0, 0, LARGURA, 6], fill=accent)

    for linha in linhas_titulo:
        draw.text((MARGEM, y), linha, font=fonte_titulo, fill=(24, 24, 27))
        y += 32
    y += 8

    draw.text((MARGEM, y), "QUANDO", font=fonte_label, fill=(113, 113, 122))
    y += 20
    draw.text((MARGEM, y), data_local_fmt, font=fonte_valor, fill=(24, 24, 27))
    y += 36

    draw.text((MARGEM, y), "ONDE", font=fonte_label, fill=(113, 113, 122))
    y += 20
    for linha in _quebrar_linhas(draw, local, fonte_valor, LARGURA - 2 * MARGEM)[:2]:
        draw.text((MARGEM, y), linha, font=fonte_valor, fill=(24, 24, 27))
        y += 24

    if assento_txt:
        y += 8
        draw.text((MARGEM, y), "ASSENTO", font=fonte_label, fill=(113, 113, 122))
        y += 20
        draw.text((MARGEM, y), assento_txt, font=fonte_valor, fill=(24, 24, 27))
        y += 12

    y += 16

    draw.line([(MARGEM, y), (LARGURA - MARGEM, y)], fill=(228, 228, 231), width=1)
    y += 20

    qr_bytes = gerar_qr_png_bytes(ingresso_id)
    qr_img = Image.open(io.BytesIO(qr_bytes)).convert("RGB").resize((QR_TAM, QR_TAM))
    img.paste(qr_img, ((LARGURA - QR_TAM) // 2, y))
    y += QR_TAM + 16

    nome_w = draw.textlength(participante_nome, font=fonte_valor)
    draw.text(((LARGURA - nome_w) // 2, y), participante_nome, font=fonte_valor, fill=(24, 24, 27))
    y += 22

    rodape = "EventosBR · apresente este QR na entrada"
    rodape_w = draw.textlength(rodape, font=fonte_rodape)
    draw.text(((LARGURA - rodape_w) // 2, y), rodape, font=fonte_rodape, fill=(161, 161, 170))

    buf = io.BytesIO()
    img.save(buf, format="PNG", optimize=True)
    return buf.getvalue()


def montar_carteirinha_ingresso_bytes(ingresso: "Ingresso") -> bytes:
    """Carteirinha padrão do ingresso — usada tanto no e-mail quanto na tela de
    impressão/conta, pra evitar dois formatos visuais diferentes pro mesmo ingresso."""
    evento = ingresso.evento
    data_local_fmt = (
        evento.data_inicio.strftime("%d/%m/%Y às %H:%M")
        if getattr(evento, "data_inicio", None)
        else "Data a confirmar"
    )
    return gerar_ticket_card_png_bytes(
        ingresso_id=ingresso.id,
        evento_nome=evento.nome,
        data_local_fmt=data_local_fmt,
        local=evento.local,
        participante_nome=ingresso.participante_nome,
        assento=getattr(ingresso, "assento", None),
    )
