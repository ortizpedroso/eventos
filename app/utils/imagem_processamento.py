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

    Se o Pillow não conseguir abrir o arquivo, ou o resultado processado ficar maior
    que o original, devolve o conteúdo original sem alterações — nunca bloqueia o
    upload por causa de uma falha aqui.
    """
    try:
        from PIL import Image
    except ImportError:
        logger.warning("Pillow não disponível — upload seguirá sem redimensionar.")
        return content, content_type

    try:
        img = Image.open(io.BytesIO(content))
        img.load()
    except Exception as e:
        logger.info("Não foi possível abrir imagem para redimensionar (%s) — mantendo original.", e)
        return content, content_type

    largura, altura = img.size
    escala = min(1.0, max_width / largura, max_height / altura)

    if escala < 1.0:
        nova_largura = max(1, round(largura * escala))
        nova_altura = max(1, round(altura * escala))
        img = img.resize((nova_largura, nova_altura), Image.LANCZOS)

    # Preserva transparência (RGBA) — comum em logos/favicons.
    if img.mode not in ("RGB", "RGBA"):
        img = img.convert("RGBA" if "transparency" in img.info or img.mode in ("P", "LA") else "RGB")

    buffer = io.BytesIO()
    try:
        img.save(buffer, format="WEBP", quality=qualidade, method=6)
    except Exception as e:
        logger.info("Falha ao recodificar em WebP (%s) — mantendo original.", e)
        return content, content_type

    novo_conteudo = buffer.getvalue()
    if escala == 1.0 and len(novo_conteudo) >= len(content):
        # Já era pequena e recodificar não ajudou — não vale trocar de formato à toa.
        return content, content_type

    return novo_conteudo, "image/webp"
