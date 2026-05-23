"""Escape de conteúdo dinâmico em templates HTML."""

from __future__ import annotations

import html


def esc(text: object | None) -> str:
    if text is None:
        return ""
    return html.escape(str(text), quote=True)
