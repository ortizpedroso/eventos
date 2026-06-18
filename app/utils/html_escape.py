"""Escape de conteúdo dinâmico em templates HTML."""

from __future__ import annotations

import html
import re


def esc(text: object | None) -> str:
    if text is None:
        return ""
    return html.escape(str(text), quote=True)


def assunto_email_seguro(text: object | None, *, max_len: int = 200) -> str:
    """Texto plano para assunto de e-mail (sem quebras de linha)."""
    if text is None:
        return ""
    s = re.sub(r"[\r\n\x00]", "", str(text)).strip()
    return s[:max_len]

