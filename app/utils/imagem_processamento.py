"""Redimensiona/comprime imagens no servidor antes de gravar — defesa em profundidade
além da compressão que já acontece no navegador (lib/comprimir-imagem.ts no frontend),
cobrindo uploads que não passaram por lá (API direta, navegadores sem suporte a
createImageBitmap, etc).

Usa Pillow (já é dependência do projeto — scripts/generate_og_image.py já usa).
"""

from __future__ import annotations

import io
import logging

logger = logging.getLogger(__name__)


def redimensionar_imagem(
    content: bytes,
    content_type: str,
    *,
    max_width: int,
    max_height: int,
    qualidade: int = 85,
) -> tuple[bytes, str]:
    """Redimensiona (só encolhe) e recodifica em WebP. Nunca aumenta a imagem.

    Bytes que não forem imagem válida → ``ValueError`` (fail-closed).
    Se Pillow não estiver instalado, devolve o original (ambiente degradado).
    Se a recodificação WebP falhar ou não reduzir, devolve o original **já validado**.
    """
    try:
        from PIL import Image, ImageOps
    except ImportError:
        logger.warning("Pillow não disponível — upload seguirá sem redimensionar.")
        return content, content_type

    try:
        img = Image.open(io.BytesIO(content))
        img.load()
    except Exception as e:
        logger.info("Arquivo de imagem inválido (%s) — rejeitando upload.", e)
        raise ValueError("Arquivo de imagem inválido ou corrompido.") from e

    try:
        img = ImageOps.exif_transpose(img) or img
    except Exception as e:
        logger.info("EXIF transpose ignorado (%s).", e)

    largura, altura = img.size
    if largura < 1 or altura < 1:
        raise ValueError("Arquivo de imagem inválido ou corrompido.")

    try:
        escala = min(1.0, max_width / largura, max_height / altura)

        if escala < 1.0:
            nova_largura = max(1, round(largura * escala))
            nova_altura = max(1, round(altura * escala))
            resample = getattr(getattr(Image, "Resampling", Image), "LANCZOS", Image.LANCZOS)
            img = img.resize((nova_largura, nova_altura), resample)

        # Preserva transparência (RGBA) — comum em logos/favicons.
        # Inclui P/PA/LA (paleta e luminância com alpha).
        if img.mode not in ("RGB", "RGBA"):
            tem_alpha = (
                "transparency" in img.info
                or img.mode in ("P", "PA", "LA")
                or (img.mode.endswith("A") and img.mode != "RGBA")
            )
            img = img.convert("RGBA" if tem_alpha else "RGB")

        buffer = io.BytesIO()
        img.save(buffer, format="WEBP", quality=qualidade, method=6)
    except ValueError:
        raise
    except Exception as e:
        # Resize/convert/WebP — não derruba o upload com 500; tenta manter o original validado.
        logger.info("Falha ao redimensionar/recodificar (%s) — mantendo original validado.", e)
        return content, content_type

    novo_conteudo = buffer.getvalue()
    if not novo_conteudo:
        return content, content_type
    if escala == 1.0 and len(novo_conteudo) >= len(content):
        # Já era pequena e recodificar não ajudou — não vale trocar de formato à toa.
        return content, content_type

    return novo_conteudo, "image/webp"
