"""Verificações de configuração para produção (logs no arranque + painel admin)."""

from __future__ import annotations

import logging

from config.settings import settings

logger = logging.getLogger(__name__)


def _ok_secret(value: str | None, min_len: int = 16) -> bool:
    v = (value or "").strip()
    return len(v) >= min_len and v not in ("sua-chave-secreta-muito-segura-aqui-min32chars",)


def build_setup_status() -> dict:
    """Estado da configuração (sem expor segredos)."""
    smtp_ok = bool((settings.EMAIL_USER or "").strip() and (settings.EMAIL_PASSWORD or "").strip())
    admin_ok = bool((settings.PLATFORM_ADMIN_API_KEY or "").strip())
    cors = (settings.CORS_ORIGINS or "").strip()
    cors_ok = bool(cors and cors != "*")
    sk_ok = _ok_secret(settings.SECRET_KEY, 32)

    asaas_ok = not settings.ASAAS_DISABLED and _ok_secret(settings.ASAAS_API_KEY, 20)
    asaas_wallet_ok = bool((settings.ASAAS_PLATFORM_WALLET_ID or "").strip())
    asaas_webhook = (settings.ASAAS_WEBHOOK_TOKEN or "").strip()
    asaas_webhook_ok = bool(asaas_webhook)

    if settings.ASAAS_DISABLED:
        asaas_api_status = "desativado_asaas"
    elif asaas_ok:
        asaas_api_status = "ok"
    else:
        asaas_api_status = "pendente"

    if settings.ASAAS_DISABLED:
        asaas_webhook_status = "desativado_asaas"
    elif asaas_webhook_ok:
        asaas_webhook_status = "ok"
    elif settings.ENVIRONMENT != "production":
        asaas_webhook_status = "dev_sem_token"
    else:
        asaas_webhook_status = "pendente"

    if settings.ASAAS_DISABLED:
        asaas_wallet_status = "desativado_asaas"
    elif asaas_wallet_ok:
        asaas_wallet_status = "ok"
    else:
        asaas_wallet_status = "pendente"

    payment_ok = asaas_ok or settings.ASAAS_DISABLED
    payment_webhook_ok = asaas_webhook_ok or asaas_webhook_status in (
        "desativado_asaas",
        "dev_sem_token",
    )
    wallet_required = asaas_wallet_ok or settings.ASAAS_DISABLED

    ready = all(
        [
            sk_ok,
            cors_ok,
            admin_ok,
            smtp_ok,
            payment_ok or settings.payments_disabled,
            payment_webhook_ok or settings.payments_disabled,
            wallet_required,
        ]
    )

    return {
        "environment": settings.ENVIRONMENT,
        "payment_provider": "asaas",
        "checks": {
            "secret_key": "ok" if sk_ok else "pendente",
            "asaas_api": asaas_api_status,
            "asaas_webhook": asaas_webhook_status,
            "asaas_platform_wallet": asaas_wallet_status,
            "smtp": "ok" if smtp_ok else "pendente",
            "platform_admin": "ok" if admin_ok else "pendente",
            "cors": "ok" if cors_ok else "pendente",
            "redis": "ok" if (settings.REDIS_URL or "").strip() else "pendente",
            "frontend_url": "ok" if (settings.FRONTEND_PUBLIC_URL or "").strip() else "pendente",
        },
        "ready_for_production": ready,
    }


def log_production_warnings() -> None:
    """Avisos no arranque da API."""
    status = build_setup_status()
    if settings.ENVIRONMENT != "production":
        return
    for key, val in status["checks"].items():
        if val in ("pendente",):
            logger.warning("Produção: configuração '%s' = %s", key, val)
    if not status["ready_for_production"]:
        logger.warning(
            "Produção: nem todas as configurações críticas estão OK — veja GET /api/admin/setup"
        )
