"""Normaliza lista de domínios Turnstile (CLI: imprime JSON array)."""

from __future__ import annotations

import json
import re
import sys

# Hostnames Turnstile: sem protocolo, sem path, sem vírgulas no valor.
_HOST_RE = re.compile(
    r"^(?:localhost|(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}|"
    r"(?:\d{1,3}\.){3}\d{1,3})$",
    re.IGNORECASE,
)


def normalize_domains(raw: str) -> list[str]:
    """Aceita CSV, linhas ou um único hostname; remove espaços e duplicatas."""
    if not raw or not str(raw).strip():
        return []
    text = str(raw).replace("\n", ",").replace(";", ",")
    parts: list[str] = []
    for chunk in text.split(","):
        chunk = chunk.strip()
        if not chunk:
            continue
        # Se alguém colou "a, b, c" num campo único já splitado por vírgula — ok.
        # Se colou sem vírgulas mas com espaços entre hostnames, split extra.
        for piece in chunk.split():
            piece = piece.strip().lower()
            if piece.startswith("http://") or piece.startswith("https://"):
                piece = piece.split("//", 1)[1].split("/", 1)[0]
            if piece.endswith("/"):
                piece = piece[:-1]
            if piece and piece not in parts:
                parts.append(piece)
    return parts


def validate_domains(domains: list[str]) -> list[str]:
    bad = [d for d in domains if not _HOST_RE.match(d)]
    if bad:
        raise ValueError(
            "hostname(s) inválido(s): "
            + ", ".join(bad)
            + ". Use um domínio por entrada (sem vírgulas no mesmo campo). "
            "Ex.: eventosbr.app.br e www.eventosbr.app.br separados."
        )
    return domains


if __name__ == "__main__":
    raw = sys.argv[1] if len(sys.argv) > 1 else ""
    domains = validate_domains(normalize_domains(raw))
    print(json.dumps(domains))
