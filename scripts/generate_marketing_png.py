#!/usr/bin/env python3
"""Gera PNGs de marketing (/public/marketing/) a partir dos mockups do produto."""

from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "frontend" / "public" / "marketing"


def _font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    candidates = [
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf" if bold else "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf" if bold else "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
    ]
    for path in candidates:
        if Path(path).exists():
            return ImageFont.truetype(path, size)
    return ImageFont.load_default()


def _draw_organizador(draw: ImageDraw.ImageDraw, w: int, h: int) -> None:
    draw.rectangle((0, 0, w, h), fill="#fafafa")
    draw.rounded_rectangle((40, 40, 240, h - 40), radius=12, fill="#18181b")
    draw.rounded_rectangle((70, 80, 210, 92), radius=4, fill="#3f3f46")
    draw.rounded_rectangle((70, 110, 170, 122), radius=4, fill="#52525b")
    draw.rounded_rectangle((70, 150, 190, 162), radius=4, fill="#10b981")
    draw.rounded_rectangle((260, 40, w - 40, 240), radius=12, outline="#e4e4e7", fill="#ffffff")
    draw.rounded_rectangle((260, 260, w - 40, h - 40), radius=12, outline="#e4e4e7", fill="#ffffff")
    draw.text((290, 70), "Meus eventos", fill="#18181b", font=_font(22, True))
    draw.rounded_rectangle((290, 110, w - 70, 150), radius=6, fill="#ecfdf5")
    draw.text((300, 118), "Show Pré-venda · 42 vendidos", fill="#065f46", font=_font(14))
    draw.text((290, 290), "Financeiro Asaas", fill="#18181b", font=_font(22, True))
    draw.rounded_rectangle((290, 330, 470, 410), radius=8, fill="#d1fae5")
    draw.text((305, 350), "Líquido estimado", fill="#065f46", font=_font(13))
    draw.text((305, 372), "R$ 4.280,00", fill="#064e3b", font=_font(20, True))


def _draw_checkout(draw: ImageDraw.ImageDraw, w: int, h: int) -> None:
    draw.rectangle((0, 0, w, h), fill="#f4f4f5")
    draw.rounded_rectangle((60, 50, w - 60, h - 50), radius=16, outline="#d4d4d8", fill="#ffffff")
    draw.text((90, 80), "Checkout seguro · Asaas", fill="#18181b", font=_font(24, True))
    draw.rounded_rectangle((90, 130, 350, 175), radius=8, fill="#ecfdf5", outline="#10b981")
    draw.text((105, 145), "PIX · Cartão · Boleto", fill="#065f46", font=_font(16, True))
    draw.text((90, 200), "Ingresso · R$ 49,90", fill="#3f3f46", font=_font(16))
    draw.rounded_rectangle((90, 240, 420, 285), radius=8, fill="#fafafa", outline="#e4e4e7")
    draw.text((105, 255), "3x de R$ 16,63 · total R$ 49,90", fill="#18181b", font=_font(15))
    draw.rounded_rectangle((90, 310, 260, 355), radius=8, fill="#059669")
    draw.text((120, 325), "Pagar com Asaas", fill="#ffffff", font=_font(16, True))


def _draw_portaria(draw: ImageDraw.ImageDraw, w: int, h: int) -> None:
    draw.rectangle((0, 0, w, h), fill="#18181b")
    draw.rounded_rectangle((80, 60, w - 80, h - 60), radius=16, fill="#27272a")
    draw.text((110, 90), "Portaria · Check-in", fill="#fafafa", font=_font(24, True))
    draw.rounded_rectangle((110, 140, 310, 340), radius=8, fill="#ffffff")
    draw.rectangle((130, 160, 290, 320), fill="#f4f4f5")
    draw.text((150, 355), "QR válido · Participante João", fill="#a1a1aa", font=_font(14))
    draw.rounded_rectangle((340, 140, w - 110, 200), radius=8, fill="#10b981")
    draw.text((360, 158), "Validar ingresso", fill="#ffffff", font=_font(16, True))


def _save(name: str, painter) -> None:
    img = Image.new("RGB", (800, 500), "#ffffff")
    painter(ImageDraw.Draw(img), 800, 500)
    path = OUT / name
    img.save(path, format="WEBP", quality=88, method=6)
    print(f"Wrote {path}")


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    _save("organizador.webp", _draw_organizador)
    _save("checkout.webp", _draw_checkout)
    _save("portaria.webp", _draw_portaria)


if __name__ == "__main__":
    main()
