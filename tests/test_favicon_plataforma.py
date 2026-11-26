"""O ícone da aba é o da EventosBR, não o padrão do Next.js (círculo preto com triângulo)."""

from pathlib import Path

from PIL import Image

PUBLIC = Path("frontend/public")


def test_favicon_ico_e_o_icone_verde_da_marca():
    with Image.open(PUBLIC / "favicon.ico") as ico:
        assert (32, 32) in ico.info["sizes"]
        ico.size = (32, 32)
        r, g, b, _ = ico.convert("RGBA").getpixel((6, 16))
    assert g > 150 and r < 60 and b < 170, f"esperado o verde da marca, veio {(r, g, b)}"


def test_svg_vale_para_qualquer_tamanho_e_ico_so_32():
    meta = Path("frontend/src/lib/site-metadata.ts").read_text(encoding="utf-8")
    assert '{ url: "/favicon.ico", sizes: "32x32" }' in meta
    assert '{ url: "/icon.svg", type: "image/svg+xml", sizes: "any" }' in meta
