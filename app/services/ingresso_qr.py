"""QR Code único por ingresso (payload estável para check-in futuro)."""

from __future__ import annotations

import base64
import io

from app.services.ingresso_checkin import ingresso_qr_payload as codigo_checkin_payload


def ingresso_qr_payload(ingresso_id: str) -> str:
    return codigo_checkin_payload(ingresso_id)


def gerar_qr_png_bytes(ingresso_id: str) -> bytes:
    import qrcode

    img = qrcode.make(ingresso_qr_payload(ingresso_id))
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


def gerar_qr_png_base64(ingresso_id: str) -> str:
    return base64.b64encode(gerar_qr_png_bytes(ingresso_id)).decode("ascii")
