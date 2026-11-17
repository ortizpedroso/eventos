#!/usr/bin/env python3
"""Gera a imagem Open Graph padrão do site (1200x630) em /frontend/public/og-image.png.

Usada como fallback de `openGraph.images` para páginas que não têm imagem
própria (institucionais, blog sem capa, etc.) — ver frontend/src/lib/site-metadata.ts.
É a imagem que aparece na prévia do link no WhatsApp, Facebook, LinkedIn etc.

Requer uma fonte TrueType/OpenType (Inter ou DejaVu). Sem ela o script FALHA em vez
de cair na fonte bitmap padrão do Pillow (texto minúsculo e ilegível na prévia).
"""

from __future__ import annotations

import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "frontend" / "public" / "og-image.png"

W, H = 1200, 630

BRAND = "#10b981"
BRAND_DARK = "#059669"
BG_TOP = (24, 24, 27)
BG_BOTTOM = (9, 9, 11)

_FONTS = {
    "bold": [
        "/usr/share/fonts/opentype/inter/Inter-ExtraBold.otf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
    ],
    "semibold": [
        "/usr/share/fonts/opentype/inter/Inter-SemiBold.otf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
    ],
    "regular": [
        "/usr/share/fonts/opentype/inter/Inter-Medium.otf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
    ],
}


def _font(size: int, weight: str = "regular") -> ImageFont.FreeTypeFont:
    for path in _FONTS[weight]:
        if Path(path).exists():
            return ImageFont.truetype(path, size)
    sys.exit(
        "Nenhuma fonte TrueType encontrada (instale fonts-inter ou fonts-dejavu-core). "
        "Abortando para não gerar uma prévia ilegível."
    )


def _ticket_icon(draw: ImageDraw.ImageDraw, x: int, y: int, s: int) -> None:
    """Ícone de ingresso da marca (mesmo desenho de logo-icon.svg), lado `s`."""
    draw.rounded_rectangle((x, y, x + s, y + s), radius=int(s * 0.2), fill=BRAND)
    r = int(s * 0.09)
    cy = y + s // 2
    draw.ellipse((x - r, cy - r, x + r, cy + r), fill=BG_TOP)
    draw.ellipse((x + s - r, cy - r, x + s + r, cy + r), fill=BG_TOP)
    lx = x + int(s * 0.27)
    for yy in range(y + int(s * 0.22), y + int(s * 0.8), 10):
        draw.line((lx, yy, lx, yy + 5), fill=(255, 255, 255), width=2)
    f = _font(int(s * 0.3), "bold")
    draw.text((x + s * 0.6, cy), "EBR", fill="#ffffff", font=f, anchor="mm")


def main() -> None:
    img = Image.new("RGB", (W, H), BG_BOTTOM)
    draw = ImageDraw.Draw(img)

    for y in range(H):
        t = y / H
        c = tuple(int(a + (b - a) * t) for a, b in zip(BG_TOP, BG_BOTTOM))
        draw.line([(0, y), (W, y)], fill=c)

    # Faixa verde da marca no topo e brilho suave à direita.
    draw.rectangle((0, 0, W, 10), fill=BRAND)
    glow = Image.new("L", (W, H), 0)
    ImageDraw.Draw(glow).ellipse((760, -220, 1500, 520), fill=60)
    from PIL import ImageFilter

    glow = glow.filter(ImageFilter.GaussianBlur(120))
    img.paste(Image.new("RGB", (W, H), BRAND_DARK), (0, 0), glow)
    draw = ImageDraw.Draw(img)

    left = 90
    _ticket_icon(draw, left, 110, 96)
    draw.text((left + 124, 158), "EventosBR", fill="#ffffff", font=_font(64, "bold"), anchor="lm")

    draw.text((left, 290), "Ingressos para shows,", fill="#ffffff", font=_font(58, "bold"))
    draw.text((left, 360), "festas e eventos", fill=BRAND, font=_font(58, "bold"))

    chips = ["PIX e cartão", "QR Code na entrada", "Repasse ao organizador"]
    cf = _font(24, "semibold")
    x, y0 = left, 478
    for chip in chips:
        tw = draw.textlength(chip, font=cf)
        draw.rounded_rectangle(
            (x, y0, x + tw + 44, y0 + 50), radius=25, fill="#052e1f", outline=BRAND, width=2
        )
        draw.text((x + 22, y0 + 25), chip, fill="#6ee7b7", font=cf, anchor="lm")
        x += tw + 44 + 16

    draw.text((W - 90, H - 40), "eventosbr.app.br", fill="#a1a1aa", font=_font(26), anchor="rs")

    OUT.parent.mkdir(parents=True, exist_ok=True)
    img.save(OUT, format="PNG", optimize=True)
    print(f"Wrote {OUT}")


if __name__ == "__main__":
    main()
