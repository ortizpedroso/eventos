"""Criptografia simétrica para segredos em repouso (ex.: API keys Asaas)."""

from __future__ import annotations

import base64
import logging

from cryptography.fernet import Fernet, InvalidToken
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC

from config.settings import settings

logger = logging.getLogger(__name__)

ENC_PREFIX = "enc:v1:"
_KDF_SALT = b"eventosbr-asaas-subaccount-v1"


def _fernet() -> Fernet:
    secret = (settings.SECRET_KEY or "dev-only-insecure-secret-key-32chars!!").encode("utf-8")
    kdf = PBKDF2HMAC(
        algorithm=hashes.SHA256(),
        length=32,
        salt=_KDF_SALT,
        iterations=600_000,
    )
    key = base64.urlsafe_b64encode(kdf.derive(secret))
    return Fernet(key)


def is_encrypted_at_rest(value: str | None) -> bool:
    return bool(value and value.strip().startswith(ENC_PREFIX))


def encrypt_at_rest(value: str) -> str:
    """Cifra texto para persistência; valores vazios passam direto."""
    raw = (value or "").strip()
    if not raw:
        return ""
    if is_encrypted_at_rest(raw):
        return raw
    token = _fernet().encrypt(raw.encode("utf-8")).decode("ascii")
    return f"{ENC_PREFIX}{token}"


def decrypt_at_rest(value: str | None) -> str:
    """Decifra valor persistido; legado em texto plano retorna como está."""
    raw = (value or "").strip()
    if not raw:
        return ""
    if not is_encrypted_at_rest(raw):
        return raw
    token = raw[len(ENC_PREFIX) :].encode("ascii")
    try:
        return _fernet().decrypt(token).decode("utf-8")
    except InvalidToken:
        logger.error("Falha ao decifrar segredo em repouso (SECRET_KEY alterada?)")
        return ""
