"""Validação e normalização de URLs públicas (perfil, redes sociais, rodapé)."""

from __future__ import annotations

import re
from urllib.parse import urlparse

_WHATSAPP_RE = re.compile(
    r"^https://(wa\.me|api\.whatsapp\.com|web\.whatsapp\.com)/",
    re.I,
)
_TEL_RE = re.compile(r"^tel:\+?[0-9]{10,15}$", re.I)
_INSTAGRAM_HANDLE_RE = re.compile(r"^@?[A-Za-z0-9._]{1,30}$")
_DIGITS_RE = re.compile(r"\D+")


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


def normalizar_url_instagram(v: object) -> str | None:
    """Aceita URL completa, instagram.com/... ou @usuario → https://instagram.com/..."""
    if v is None:
        return None
    if not isinstance(v, str):
        raise ValueError("Instagram deve ser texto ou nulo")
    s = v.strip()
    if not s or s == "#":
        return None

    lower = s.lower()
    if lower.startswith(("http://", "https://")):
        return validar_url_http_https(s)

    # instagram.com/user ou www.instagram.com/user
    if "instagram.com/" in lower:
        path = s.split("instagram.com/", 1)[1].split("?")[0].strip("/")
        if not path:
            raise ValueError("Informe o usuário ou o link completo do Instagram")
        return f"https://instagram.com/{path.split('/')[0]}"

    if _INSTAGRAM_HANDLE_RE.match(s):
        handle = s.lstrip("@")
        return f"https://instagram.com/{handle}"

    raise ValueError(
        "Instagram inválido. Use o @usuario, o link (instagram.com/...) ou https://instagram.com/..."
    )


def normalizar_url_whatsapp(v: object) -> str | None:
    """Aceita número BR, wa.me ou tel: → https://wa.me/55..."""
    if v is None:
        return None
    if not isinstance(v, str):
        raise ValueError("WhatsApp deve ser texto ou nulo")
    s = v.strip()
    if not s or s == "#":
        return None

    if _TEL_RE.match(s):
        digits = re.sub(r"\D", "", s)
        if digits.startswith("55") and len(digits) >= 12:
            return f"https://wa.me/{digits}"
        if len(digits) in (10, 11):
            return f"https://wa.me/55{digits}"
        return f"https://wa.me/{digits}"

    lower = s.lower()
    if lower.startswith(("http://", "https://")):
        canonical = s if lower.startswith("https://") else "https://" + s.split("://", 1)[1]
        if _WHATSAPP_RE.match(canonical):
            parsed = urlparse(canonical)
            path_digits = re.sub(r"\D", "", parsed.path or "")
            if path_digits:
                if path_digits.startswith("55") and len(path_digits) >= 12:
                    return f"https://wa.me/{path_digits}"
                if len(path_digits) in (10, 11):
                    return f"https://wa.me/55{path_digits}"
                return f"https://wa.me/{path_digits}"
            return validar_url_http_https(canonical)
        return validar_url_http_https(canonical)

    # Número puro ou formatado: (11) 99999-9999
    digits = _DIGITS_RE.sub("", s)
    if digits.isdigit() and 10 <= len(digits) <= 13:
        if digits.startswith("55") and len(digits) >= 12:
            return f"https://wa.me/{digits}"
        if len(digits) in (10, 11):
            return f"https://wa.me/55{digits}"
        return f"https://wa.me/{digits}"

    raise ValueError(
        "WhatsApp inválido. Informe o número com DDD (ex.: 11999999999) ou o link https://wa.me/55..."
    )


def validar_url_whatsapp(v: object) -> str | None:
    """Compat: normaliza número/URL de WhatsApp para link clicável."""
    return normalizar_url_whatsapp(v)


_META_PIXEL_RE = re.compile(r"^\d{5,20}$")
_GTM_RE = re.compile(r"^GTM-[A-Z0-9]+$", re.I)


def normalizar_meta_pixel_id(v: object) -> str | None:
    """Aceita ID numérico do Meta Events Manager (5–20 dígitos)."""
    if v is None:
        return None
    if not isinstance(v, str):
        raise ValueError("Meta Pixel ID deve ser texto ou nulo")
    s = v.strip()
    if not s:
        return None
    digits = _DIGITS_RE.sub("", s)
    if not _META_PIXEL_RE.match(digits):
        raise ValueError(
            "Meta Pixel ID inválido. Use o número do Events Manager (ex.: 123456789012345)."
        )
    return digits


def normalizar_gtm_id(v: object) -> str | None:
    """Aceita container GTM-XXXXXXX."""
    if v is None:
        return None
    if not isinstance(v, str):
        raise ValueError("GTM ID deve ser texto ou nulo")
    s = v.strip().upper()
    if not s:
        return None
    if not _GTM_RE.match(s):
        raise ValueError("GTM ID inválido. Use o formato GTM-XXXXXXX.")
    return s
