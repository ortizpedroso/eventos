"""Validação de URLs públicas (perfil, redes sociais)."""

from __future__ import annotations

import re
from urllib.parse import urlparse

_WHATSAPP_RE = re.compile(
    r"^https://(wa\.me|api\.whatsapp\.com|web\.whatsapp\.com)/",
    re.I,
)
_TEL_RE = re.compile(r"^tel:\+?[0-9]{10,15}$")


def validar_url_http_https(v: object) -> str | None:
    if v is None:
        return None
    if not isinstance(v, str):
        raise ValueError("URL deve ser texto ou nulo")
    s = v.strip()
    if not s:
        return None
    if len(s) > 2048:
        raise ValueError("URL excede 2048 caracteres")
    parsed = urlparse(s)
    if parsed.scheme not in ("https", "http"):
        raise ValueError("URL deve usar http:// ou https://")
    if not parsed.netloc:
        raise ValueError("URL inválida")
    return s


def validar_url_whatsapp(v: object) -> str | None:
    if v is None:
        return None
    if not isinstance(v, str):
        raise ValueError("URL deve ser texto ou nulo")
    s = v.strip()
    if not s:
        return None
    if len(s) > 500:
        raise ValueError("URL excede 500 caracteres")
    if _TEL_RE.match(s):
        return s
    if _WHATSAPP_RE.match(s):
        return s
    return validar_url_http_https(s)
