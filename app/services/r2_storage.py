"""Upload de imagens de capa de evento para o Cloudflare R2 (compatível com API S3).

Vazio/mal configurado (`settings.r2_configured` False) → funções levantam RuntimeError;
o chamador (rota) deve tratar isso como "R2 não configurado" e cair no fluxo legado
(base64 direto no campo `imagem_url`), sem quebrar quem já usa a plataforma.
"""

from __future__ import annotations

import logging
import mimetypes
import uuid

import boto3
from botocore.client import Config as BotoConfig
from botocore.exceptions import BotoCoreError, ClientError

from app.utils.imagem_processamento import redimensionar_imagem
from config.settings import settings

logger = logging.getLogger(__name__)

MAX_UPLOAD_BYTES = 5 * 1024 * 1024  # 5MB — folga sobre o limite atual do campo (1,25MB)
ALLOWED_CONTENT_TYPES = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
}


class R2UploadError(ValueError):
    """Erro de validação (tipo/tamanho) — 400 para o cliente, não é falha de infra."""


def _client():
    if not settings.r2_configured:
        raise RuntimeError("R2 não configurado (defina R2_ACCOUNT_ID/R2_ACCESS_KEY_ID/... no .env).")
    return boto3.client(
        "s3",
        endpoint_url=settings.r2_endpoint_url,
        aws_access_key_id=settings.R2_ACCESS_KEY_ID,
        aws_secret_access_key=settings.R2_SECRET_ACCESS_KEY,
        config=BotoConfig(signature_version="s3v4", region_name="auto"),
    )


def upload_imagem_evento(content: bytes, content_type: str, *, prefixo: str = "eventos") -> str:
    """Envia bytes de imagem para o R2 e devolve a URL pública.

    Levanta R2UploadError (validação, 400 para o cliente) ou RuntimeError (infra/config —
    o chamador deve cair para o storage local em disco, ver app/routes/assets.py).
    """
    ct = (content_type or "").split(";")[0].strip().lower()
    ext = ALLOWED_CONTENT_TYPES.get(ct)
    if not ext:
        raise R2UploadError(
            "Formato de imagem não suportado. Envie JPEG, PNG, WebP ou GIF."
        )
    if not content:
        raise R2UploadError("Arquivo vazio.")
    if len(content) > MAX_UPLOAD_BYTES:
        raise R2UploadError(f"Arquivo maior que {MAX_UPLOAD_BYTES // (1024 * 1024)}MB.")

    try:
        content, ct = redimensionar_imagem(content, ct, max_width=1920, max_height=1080)
    except ValueError as e:
        raise R2UploadError(str(e)) from e
    ext = ALLOWED_CONTENT_TYPES.get(ct, ext)

    key = f"{prefixo}/{uuid.uuid4().hex}.{ext}"

    try:
        _client().put_object(
            Bucket=settings.R2_BUCKET_NAME,
            Key=key,
            Body=content,
            ContentType=ct,
            CacheControl="public, max-age=31536000, immutable",
        )
    except (ClientError, BotoCoreError) as e:
        logger.error("Falha ao enviar imagem para R2: %s", e)
        raise RuntimeError("Falha ao enviar imagem para o armazenamento.") from e

    base = settings.R2_PUBLIC_URL.rstrip("/")
    return f"{base}/{key}"


def guess_content_type(filename: str | None, fallback: str | None) -> str:
    if fallback:
        return fallback
    guessed, _ = mimetypes.guess_type(filename or "")
    return guessed or "application/octet-stream"
