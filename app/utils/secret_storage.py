"""Criptografia simétrica para segredos em repouso (ex.: API keys Asaas).

Esquema enc:v2:<b64_salt>:<b64_ciphertext>
- Salt aleatório por-registro (32 bytes), não há precomputação mesmo com SECRET_KEY vazada.
- PBKDF2HMAC SHA-256, 600.000 iterações.
- Legado enc:v1:<token> (salt estático) ainda é decifrado; re-cifrado automaticamente na
  próxima gravação que chame encrypt_at_rest.

Para rotacionar SECRET_KEY:
    from app.utils.secret_storage import migrate_encryption
    migrate_encryption(db, old_key="...", new_key="...")
"""

from __future__ import annotations

import base64
import logging
import os

from cryptography.fernet import Fernet, InvalidToken
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC

from config.settings import settings

logger = logging.getLogger(__name__)

ENC_PREFIX_V1 = "enc:v1:"
ENC_PREFIX_V2 = "enc:v2:"
ENC_PREFIX = ENC_PREFIX_V2

# Salt legado (v1) — mantido só para decifrar registros antigos.
_KDF_SALT_V1 = b"eventosbr-asaas-subaccount-v1"
_PBKDF2_ITERATIONS = 600_000


def _require_secret_key() -> bytes:
    """Retorna SECRET_KEY como bytes. RuntimeError se ausente (fail-closed)."""
    key = (settings.SECRET_KEY or "").strip()
    if not key:
        raise RuntimeError(
            "SECRET_KEY não configurada. Defina SECRET_KEY no .env antes de operar com segredos cifrados."
        )
    return key.encode("utf-8")


def _fernet_with_salt(secret: bytes, salt: bytes) -> Fernet:
    kdf = PBKDF2HMAC(
        algorithm=hashes.SHA256(),
        length=32,
        salt=salt,
        iterations=_PBKDF2_ITERATIONS,
    )
    return Fernet(base64.urlsafe_b64encode(kdf.derive(secret)))


def is_encrypted_at_rest(value: str | None) -> bool:
    return bool(value and (value.strip().startswith(ENC_PREFIX_V1) or value.strip().startswith(ENC_PREFIX_V2)))


def encrypt_at_rest(value: str) -> str:
    """Cifra texto para persistência (enc:v2); valores vazios passam direto."""
    raw = (value or "").strip()
    if not raw:
        return ""
    if raw.startswith(ENC_PREFIX_V2):
        return raw
    # Sempre re-cifra v1 para v2 quando encrypt_at_rest é chamado explicitamente.
    if raw.startswith(ENC_PREFIX_V1):
        raw = _decrypt_v1(_require_secret_key(), raw)
        if not raw:
            return ""
    secret = _require_secret_key()
    salt = os.urandom(32)
    token = _fernet_with_salt(secret, salt).encrypt(raw.encode("utf-8")).decode("ascii")
    salt_b64 = base64.urlsafe_b64encode(salt).decode("ascii")
    return f"{ENC_PREFIX_V2}{salt_b64}:{token}"


def decrypt_at_rest(value: str | None) -> str:
    """Decifra valor persistido. Legado em texto plano retorna como está.

    Lança RuntimeError se SECRET_KEY ausente (não retorna string vazia silenciosamente).
    """
    raw = (value or "").strip()
    if not raw:
        return ""
    if raw.startswith(ENC_PREFIX_V2):
        return _decrypt_v2(_require_secret_key(), raw)
    if raw.startswith(ENC_PREFIX_V1):
        return _decrypt_v1(_require_secret_key(), raw)
    # Texto plano (legado pré-cifra)
    return raw


def _decrypt_v2(secret: bytes, raw: str) -> str:
    payload = raw[len(ENC_PREFIX_V2):]
    parts = payload.split(":", 1)
    if len(parts) != 2:
        logger.error("Formato enc:v2 inválido (falta salt)")
        raise RuntimeError("Segredo corrompido (enc:v2 inválido). Verifique o banco.")
    try:
        salt = base64.urlsafe_b64decode(parts[0])
        return _fernet_with_salt(secret, salt).decrypt(parts[1].encode("ascii")).decode("utf-8")
    except (InvalidToken, Exception) as exc:
        logger.error("Falha ao decifrar segredo enc:v2: %s", exc)
        raise RuntimeError(
            "Falha ao decifrar segredo (SECRET_KEY alterada sem rotação de chave?). "
            "Execute migrate_encryption() com a chave antiga antes de usar a nova."
        ) from exc


def _decrypt_v1(secret: bytes, raw: str) -> str:
    token = raw[len(ENC_PREFIX_V1):].encode("ascii")
    try:
        kdf = PBKDF2HMAC(
            algorithm=hashes.SHA256(),
            length=32,
            salt=_KDF_SALT_V1,
            iterations=_PBKDF2_ITERATIONS,
        )
        fernet = Fernet(base64.urlsafe_b64encode(kdf.derive(secret)))
        return fernet.decrypt(token).decode("utf-8")
    except (InvalidToken, Exception) as exc:
        logger.error("Falha ao decifrar segredo enc:v1: %s", exc)
        raise RuntimeError(
            "Falha ao decifrar segredo legado (enc:v1). SECRET_KEY foi alterada? "
            "Execute migrate_encryption() com a chave antiga."
        ) from exc


def migrate_encryption(db, old_key: str, new_key: str) -> int:
    """Re-cifra todos os asaas_subaccount_api_key de enc:v1/v2 com old_key para enc:v2 com new_key.

    Uso:
        from app.utils.secret_storage import migrate_encryption
        from config.database import SessionLocal
        db = SessionLocal()
        n = migrate_encryption(db, old_key="CHAVE_ANTIGA", new_key="CHAVE_NOVA")
        print(f"{n} registros migrados")
        db.close()
    """
    from app.models import Usuario

    old_bytes = old_key.strip().encode("utf-8")
    new_bytes = new_key.strip().encode("utf-8")
    updated = 0
    for usuario in db.query(Usuario).filter(
        Usuario.asaas_subaccount_api_key.isnot(None),
        Usuario.asaas_subaccount_api_key != "",
    ).all():
        raw_enc = (usuario.asaas_subaccount_api_key or "").strip()
        if not is_encrypted_at_rest(raw_enc):
            continue
        try:
            if raw_enc.startswith(ENC_PREFIX_V2):
                plain = _decrypt_v2(old_bytes, raw_enc)
            else:
                plain = _decrypt_v1(old_bytes, raw_enc)
        except RuntimeError:
            logger.error("Não foi possível decifrar registro do usuário %s com old_key", usuario.id)
            continue
        salt = os.urandom(32)
        token = _fernet_with_salt(new_bytes, salt).encrypt(plain.encode("utf-8")).decode("ascii")
        salt_b64 = base64.urlsafe_b64encode(salt).decode("ascii")
        usuario.asaas_subaccount_api_key = f"{ENC_PREFIX_V2}{salt_b64}:{token}"
        updated += 1
    db.commit()
    logger.info("migrate_encryption: %d registros re-cifrados", updated)
    return updated
