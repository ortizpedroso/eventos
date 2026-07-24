"""Armazenamento local de imagens enviadas (logo, favicon, fotos)."""

from __future__ import annotations

import re
import uuid
from pathlib import Path

from config.settings import settings

ALLOWED_IMAGE_TYPES = frozenset(
    {
        "image/jpeg",
        "image/png",
        "image/webp",
        "image/gif",
        "image/svg+xml",
        "image/x-icon",
        "image/vnd.microsoft.icon",
    }
)
MAX_UPLOAD_BYTES = int(1.25 * 1024 * 1024)

_EXT_BY_TYPE = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/gif": ".gif",
    "image/svg+xml": ".svg",
    "image/x-icon": ".ico",
    "image/vnd.microsoft.icon": ".ico",
}

_SAFE_SUBDIR = re.compile(r"^[a-z0-9_-]{1,32}$")


def upload_root() -> Path:
    root = Path(settings.UPLOAD_DIR or "uploads")
    root.mkdir(parents=True, exist_ok=True)
    return root


def public_upload_url(relative_path: str) -> str:
    rel = relative_path.lstrip("/")
    base = (
        (settings.UPLOAD_PUBLIC_BASE_URL or settings.FRONTEND_PUBLIC_URL or "http://localhost:3000")
        .rstrip("/")
    )
    return f"{base}/uploads/{rel}"


def save_image_upload(*, content: bytes, content_type: str, subdir: str) -> str:
    if not _SAFE_SUBDIR.match(subdir):
        raise ValueError("subdir inválido")
    if content_type not in ALLOWED_IMAGE_TYPES:
        raise ValueError("Tipo de arquivo não permitido")
    if len(content) > MAX_UPLOAD_BYTES:
        raise ValueError("Arquivo excede 1,25 MB")

    ext = _EXT_BY_TYPE.get(content_type, ".bin")
    name = f"{uuid.uuid4().hex}{ext}"
    dest_dir = upload_root() / subdir
    dest_dir.mkdir(parents=True, exist_ok=True)
    dest = dest_dir / name
    dest.write_bytes(content)
    return public_upload_url(f"{subdir}/{name}")
