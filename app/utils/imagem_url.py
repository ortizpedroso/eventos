from __future__ import annotations

import logging
import re
from urllib.parse import urlparse

from config.settings import settings

logger = logging.getLogger(__name__)

_MAX_IMAGEM_URL_LEN = 2048
_DATA_IMAGE_RE = re.compile(r"^data:image/(png|jpeg|jpg|gif|webp);base64,", re.I)


def _hosts_imagem_permitidos() -> set[str]:
    """Hosts onde imagens enviadas pela plataforma podem ser referenciadas."""
    hosts: set[str] = set()
    for raw in (
        settings.FRONTEND_PUBLIC_URL,
        settings.R2_PUBLIC_URL,
        settings.UPLOAD_PUBLIC_BASE_URL,
    ):
        s = (raw or "").strip()
        if not s:
            continue
        try:
            host = urlparse(s).hostname
            if host:
                hosts.add(host.lower())
        except Exception:
            logger.debug("Host de imagem ignorado (URL inválida): %s", raw)
    return hosts


def validar_imagem_url_formato(v: object) -> str | None:
    """Valida formato/tamanho sem restringir host (uso em PATCH antes de comparar com valor atual)."""
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
        raise ValueError("imagem_url deve usar http(s)://, /uploads/ ou data:image/*")
    if not parsed.netloc:
        raise ValueError("imagem_url inválida")
    return s


def validar_imagem_url(v: object) -> str | None:
    """Aceita https:// no nosso domínio/R2, /uploads/ local ou data:image/* base64 (limitado)."""
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
        raise ValueError("imagem_url deve usar http(s)://, /uploads/ ou data:image/*")
    if not parsed.netloc:
        raise ValueError("imagem_url inválida")
    host = (parsed.hostname or "").lower()
    permitidos = _hosts_imagem_permitidos()
    if permitidos and host not in permitidos:
        raise ValueError(
            "URL externa não permitida. Envie o arquivo pelo formulário — "
            "as imagens devem ser hospedadas na plataforma (upload ou armazenamento configurado)."
        )
    return s


def validar_imagem_url_se_alterada(nova: str | None, atual: str | None) -> str | None:
    """Na atualização: mantém URL legada se inalterada; exige host permitido se mudou."""
    if nova is None:
        return None
    if (nova or "") == (atual or ""):
        return nova
    return validar_imagem_url(nova)
