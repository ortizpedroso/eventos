#!/usr/bin/env python3
"""Gera a imagem Open Graph padrão do site (1200x630) em /frontend/public/og-image.png.

Usada como fallback de `openGraph.images` para páginas que não têm imagem
própria (institucionais, blog sem capa, etc.) — ver frontend/src/lib/site-metadata.ts.
"""

from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "frontend" / "public" / "og-image.png"

W, H = 1200, 630


def _font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
    candidates = [
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf" if bold else "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf" if bold else "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
    ]
    for path in candidates:
        if Path(path).exists():
            return ImageFont.truetype(path, size)
    return ImageFont.load_default()


def main() -> None:
    img = Image.new("RGB", (W, H), "#0a0a0a")
    draw = ImageDraw.Draw(img)

    # Gradiente vertical sutil (zinc-900 -> preto), consistente com o tema escuro da marca.
    for y in range(H):
        t = y / H
        r = int(24 + (10 - 24) * t)
        g = int(24 + (10 - 24) * t)
        b = int(27 + (10 - 27) * t)
        draw.line([(0, y), (W, y)], fill=(r, g, b))

    # Barra de destaque na cor primária da marca.
    draw.rounded_rectangle((80, 250, 130, 380), radius=8, fill="#10b981")

    draw.text((160, 250), "EventosBR", fill="#ffffff", font=_font(72, True))
    draw.text((160, 335), "Ingressos, shows e eventos no Brasil", fill="#a1a1aa", font=_font(30))

    chips = ["PIX", "Cartão", "QR Code na entrada"]
    x = 160
    for chip in chips:
        tw = draw.textlength(chip, font=_font(20, True))
        draw.rounded_rectangle((x, 420, x + tw + 40, 462), radius=21, fill="#052e1f", outline="#10b981")
        draw.text((x + 20, 431), chip, fill="#6ee7b7", font=_font(20, True))
        x += tw + 40 + 16

    OUT.parent.mkdir(parents=True, exist_ok=True)
    img.save(OUT, format="PNG")
    print(f"Wrote {OUT}")


if __name__ == "__main__":
    main()
