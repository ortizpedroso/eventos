"""TOTP (RFC 6238) para autenticação em duas etapas de organizadores.

Implementação própria (HMAC-SHA1 + base32), sem dependência externa nova —
reaproveita `cryptography`/`hmac` já presentes no projeto.
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import secrets
import struct
import time
from urllib.parse import quote

_ISSUER = "EventosBR"
_STEP_SECONDS = 30
_DIGITS = 6
_WINDOW = 1  # tolera +/- 1 passo (30s) de deriva de relógio


def gerar_secret() -> str:
    """Gera um segredo base32 de 160 bits (recomendado para TOTP)."""
    raw = secrets.token_bytes(20)
    return base64.b32encode(raw).decode("ascii").rstrip("=")


def _hotp(secret_b32: str, counter: int) -> str:
    key = base64.b32decode(_pad_b32(secret_b32), casefold=True)
    msg = struct.pack(">Q", counter)
    digest = hmac.new(key, msg, hashlib.sha1).digest()
    offset = digest[-1] & 0x0F
    code_int = (struct.unpack(">I", digest[offset : offset + 4])[0] & 0x7FFFFFFF) % (10**_DIGITS)
    return str(code_int).zfill(_DIGITS)


def _pad_b32(value: str) -> str:
    value = value.strip().upper().replace(" ", "")
    padding = (-len(value)) % 8
    return value + ("=" * padding)


def gerar_codigo_atual(secret_b32: str, when: float | None = None) -> str:
    counter = int((when if when is not None else time.time()) // _STEP_SECONDS)
    return _hotp(secret_b32, counter)


def verificar_codigo(secret_b32: str, codigo: str, when: float | None = None) -> bool:
    """Verifica o código de 6 dígitos, tolerando deriva de +/- 1 passo (30s)."""
    codigo = (codigo or "").strip().replace(" ", "")
    if not codigo.isdigit() or len(codigo) != _DIGITS:
        return False
    base_counter = int((when if when is not None else time.time()) // _STEP_SECONDS)
    for delta in range(-_WINDOW, _WINDOW + 1):
        candidato = _hotp(secret_b32, base_counter + delta)
        if hmac.compare_digest(candidato, codigo):
            return True
    return False


def build_otpauth_uri(secret_b32: str, email: str) -> str:
    label = quote(f"{_ISSUER}:{email}")
    issuer = quote(_ISSUER)
    return f"otpauth://totp/{label}?secret={secret_b32}&issuer={issuer}&digits={_DIGITS}&period={_STEP_SECONDS}"


def gerar_recovery_codes(quantidade: int = 8) -> list[str]:
    """Códigos de recuperação de uso único (formato XXXX-XXXX), para uso se o dispositivo TOTP for perdido."""
    codigos = []
    alfabeto = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"  # sem caracteres ambíguos (0/O, 1/I/L)
    for _ in range(quantidade):
        parte1 = "".join(secrets.choice(alfabeto) for _ in range(4))
        parte2 = "".join(secrets.choice(alfabeto) for _ in range(4))
        codigos.append(f"{parte1}-{parte2}")
    return codigos
