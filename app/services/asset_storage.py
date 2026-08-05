"""Armazenamento local de imagens enviadas (logo, favicon, fotos)."""

from __future__ import annotations

import re
import uuid
from pathlib import Path

from app.utils.imagem_processamento import redimensionar_imagem
from config.settings import settings

ALLOWED_IMAGE_TYPES = frozenset(
    {
        "image/jpeg",
        "image/png",
        "image/webp",
        "image/gif",
    }
)
MAX_UPLOAD_BYTES = 5 * 1024 * 1024

_EXT_BY_TYPE = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/gif": ".gif",
}

_SAFE_SUBDIR = re.compile(r"^[a-z0-9_-]{1,32}(/[a-z0-9_-]{1,32})?$")


def normalize_image_content_type(content_type: str | None) -> str:
    """Normaliza MIME do upload (lowercase, sem parâmetros tipo charset)."""
    return (content_type or "").split(";")[0].strip().lower()


def upload_root() -> Path:
    root = Path(settings.UPLOAD_DIR or "uploads")
    root.mkdir(parents=True, exist_ok=True)
    return root


def public_upload_url(relative_path: str) -> str:
    """URL pública do arquivo (absoluta — e-mails e JSON-LD precisam de host)."""
    rel = relative_path.lstrip("/")
    base = (
        (settings.UPLOAD_PUBLIC_BASE_URL or settings.FRONTEND_PUBLIC_URL or "http://localhost:3000")
        .rstrip("/")
    )
    return f"{base}/uploads/{rel}"


def save_image_upload(
    *, content: bytes, content_type: str, subdir: str, max_width: int = 1024, max_height: int = 1024
) -> str:
    subdir = (subdir or "").strip().lower()
    if not _SAFE_SUBDIR.match(subdir):
        raise ValueError("subdir inválido")
    content_type = normalize_image_content_type(content_type)
    if content_type not in ALLOWED_IMAGE_TYPES:
        raise ValueError("Tipo de arquivo não permitido")
    if not content:
        raise ValueError("Arquivo vazio")
    if len(content) > MAX_UPLOAD_BYTES:
        raise ValueError(f"Arquivo excede {MAX_UPLOAD_BYTES // (1024 * 1024)}MB")

    content, content_type = redimensionar_imagem(
        content, content_type, max_width=max_width, max_height=max_height
    )

    ext = _EXT_BY_TYPE.get(content_type, ".bin")
    name = f"{uuid.uuid4().hex}{ext}"
    dest_dir = upload_root() / subdir
    try:
        dest_dir.mkdir(parents=True, exist_ok=True)
        dest = dest_dir / name
        dest.write_bytes(content)
    except OSError as e:
        raise OSError("Não foi possível gravar a imagem no servidor. Tente novamente.") from e
    return public_upload_url(f"{subdir}/{name}")
