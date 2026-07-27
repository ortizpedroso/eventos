from passlib.context import CryptContext
from datetime import datetime, timedelta, timezone
from jose import JWTError, jwt
from config.settings import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def hash_password(password: str) -> str:
    """Faz hash da senha"""
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verifica se a senha está correta"""
    return pwd_context.verify(plain_password, hashed_password)

def create_access_token(data: dict, expires_delta: timedelta = None):
    """Cria token JWT"""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc).replace(tzinfo=None) + expires_delta
    else:
        expire = datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(minutes=15)

    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt

def decode_token_payload(token: str) -> dict | None:
    """Decodifica JWT e devolve o payload ou None."""
    try:
        return jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    except JWTError:
        return None


def decode_token(token: str):
    """Decodifica token JWT e devolve o user id (sub)."""
    payload = decode_token_payload(token)
    if not payload:
        return None
    usuario_id: str | None = payload.get("sub")
    if usuario_id is None:
        return None
    return usuario_id


def token_version_from_payload(token: str) -> int | None:
    payload = decode_token_payload(token)
    if not payload:
        return None
    ver = payload.get("tv")
    if ver is None:
        return 0
    try:
        return int(ver)
    except (TypeError, ValueError):
        return None


def create_2fa_challenge_token(usuario_id: str) -> str:
    """Token de curta duração (5 min) emitido após senha correta, aguardando o código 2FA."""
    return create_access_token({"sub": usuario_id, "scope": "2fa_pending"}, expires_delta=timedelta(minutes=5))


def decode_2fa_challenge_token(token: str) -> str | None:
    """Devolve o usuario_id se o token for um desafio 2FA válido e ainda não expirado."""
    payload = decode_token_payload(token)
    if not payload or payload.get("scope") != "2fa_pending":
        return None
    return payload.get("sub")


TRUSTED_DEVICE_DIAS = 30


def create_trusted_device_token(usuario_id: str, token_version: int) -> str:
    """'Lembrar este dispositivo' — pula o desafio 2FA por até 30 dias neste navegador.

    Amarrado a token_version: se o usuário desativar/reativar 2FA ou revogar sessões
    (o que incrementa token_version), esse token de dispositivo também vira inválido
    automaticamente, sem precisar de uma lista de revogação separada.
    """
    return create_access_token(
        {"sub": usuario_id, "tv": token_version, "scope": "2fa_trusted"},
        expires_delta=timedelta(days=TRUSTED_DEVICE_DIAS),
    )


def decode_trusted_device_token(token: str, usuario_id: str, token_version: int) -> bool:
    """True se o token de dispositivo confiável é válido para este usuário/versão."""
    payload = decode_token_payload(token)
    if not payload or payload.get("scope") != "2fa_trusted":
        return False
    if payload.get("sub") != usuario_id:
        return False
    try:
        return int(payload.get("tv", -1)) == int(token_version)
    except (TypeError, ValueError):
        return False
