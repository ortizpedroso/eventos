from __future__ import annotations

import logging
import re
from urllib.parse import urlparse

from pydantic import field_validator

logger = logging.getLogger(__name__)

_MAX_IMAGEM_URL_LEN = 2048
_DATA_IMAGE_RE = re.compile(r"^data:image/(png|jpeg|jpg|gif|webp);base64,", re.I)


def validar_imagem_url(v: object) -> str | None:
    """Aceita https://, http:// (dev) ou data:image/* base64 (limitado)."""
    if v is None:
        return None
    if not isinstance(v, str):
        raise ValueError("imagem_url deve ser texto ou nulo")
    s = v.strip()
    if not s:
        return None
    if len(s) > _MAX_IMAGEM_URL_LEN:
        raise ValueError(f"imagem_url excede {_MAX_IMAGEM_URL_LEN} caracteres")
    if _DATA_IMAGE_RE.match(s):
        return s
    if s.startswith("/uploads/"):
        return s
    parsed = urlparse(s)
    if parsed.scheme not in ("https", "http"):
        raise ValueError("imagem_url deve usar http(s):// ou data:image/*")
    if not parsed.netloc:
        raise ValueError("imagem_url inválida")
    return s
