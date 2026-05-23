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
