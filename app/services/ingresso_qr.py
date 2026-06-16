"""QR Code único por ingresso (payload estável para check-in futuro)."""

from __future__ import annotations

import base64
import io
from urllib.parse import quote

from app.services.ingresso_checkin import ingresso_qr_payload as codigo_portaria_payload
from config.settings import settings


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
