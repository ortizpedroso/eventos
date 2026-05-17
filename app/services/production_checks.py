"""Verificações de configuração para produção (logs no arranque + painel admin)."""

from __future__ import annotations

import logging

from config.settings import settings

logger = logging.getLogger(__name__)

_WEBHOOK_PLACEHOLDER = "whsec_seu_webhook_secret_aqui"


def _ok_secret(value: str | None, min_len: int = 16) -> bool:
    v = (value or "").strip()
    return len(v) >= min_len and v not in (_WEBHOOK_PLACEHOLDER, "sua-chave-secreta-muito-segura-aqui-min32chars")


def build_setup_status() -> dict:
    """Estado da configuração (sem expor segredos)."""
    whsec = (settings.STRIPE_WEBHOOK_SECRET or "").strip()
    smtp_ok = bool((settings.EMAIL_USER or "").strip() and (settings.EMAIL_PASSWORD or "").strip())
    admin_ok = bool((settings.PLATFORM_ADMIN_API_KEY or "").strip())
    cors = (settings.CORS_ORIGINS or "").strip()
    cors_ok = bool(cors and cors != "*")
    sk_ok = _ok_secret(settings.SECRET_KEY, 32)
    stripe_ok = _ok_secret(settings.STRIPE_SECRET_KEY, 50) and not settings.STRIPE_DISABLED

    webhook_ok = bool(whsec and whsec != _WEBHOOK_PLACEHOLDER)
    if settings.STRIPE_DISABLED:
        webhook_status = "desativado_stripe"
    elif webhook_ok:
        webhook_status = "ok"
    elif settings.DEBUG and settings.ENVIRONMENT == "development":
        webhook_status = "dev_sem_assinatura"
    else:
        webhook_status = "pendente"

    return {
        "environment": settings.ENVIRONMENT,
        "checks": {
            "secret_key": "ok" if sk_ok else "pendente",
            "stripe_api": "ok" if stripe_ok else ("desativado" if settings.STRIPE_DISABLED else "pendente"),
            "stripe_webhook": webhook_status,
            "smtp": "ok" if smtp_ok else "pendente",
            "platform_admin": "ok" if admin_ok else "pendente",
            "cors": "ok" if cors_ok else "pendente",
            "redis": "ok" if (settings.REDIS_URL or "").strip() else "pendente",
            "frontend_url": "ok" if (settings.FRONTEND_PUBLIC_URL or "").strip() else "pendente",
        },
        "ready_for_production": all(
            [
                sk_ok,
                cors_ok,
                admin_ok,
                smtp_ok,
                stripe_ok or settings.STRIPE_DISABLED,
                webhook_ok or settings.STRIPE_DISABLED or webhook_status == "dev_sem_assinatura",
            ]
        ),
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
