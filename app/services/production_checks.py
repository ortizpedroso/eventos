"""Verificações de configuração para produção (logs no arranque + painel admin)."""

from __future__ import annotations

import logging

from config.settings import settings

logger = logging.getLogger(__name__)


def _ok_secret(value: str | None, min_len: int = 16) -> bool:
    v = (value or "").strip()
    return len(v) >= min_len and v not in ("sua-chave-secreta-muito-segura-aqui-min32chars",)


def _cors_https_ok(cors: str, production: bool) -> bool:
    """Em produção, todas as origens devem ser HTTPS (sem `*` nem http://)."""
    if not cors or cors == "*" or "*" in cors:
        return False
    if not production:
        return True
    origens = [o.strip() for o in cors.split(",") if o.strip()]
    return bool(origens) and all(o.lower().startswith("https://") for o in origens)


def _postgres_password_ok() -> bool:
    """POSTGRES_PASSWORD definido, ou DATABASE_URL já embute credencial não-placeholder."""
    pwd = (getattr(settings, "POSTGRES_PASSWORD", "") or "").strip()
    if pwd and pwd not in ("password", "postgres", "changeme"):
        return True
    url = (settings.DATABASE_URL or "").strip()
    if "sqlite" in url:
        return settings.ENVIRONMENT != "production"
    # postgresql://user:senha@host — exige senha na URL
    try:
        cred = url.split("://", 1)[1].split("@", 1)[0]
        senha = cred.split(":", 1)[1] if ":" in cred else ""
        return bool(senha) and senha not in ("password", "postgres", "changeme")
    except IndexError:
        return False


def build_setup_status() -> dict:
    """Estado da configuração (sem expor segredos)."""
    production = settings.ENVIRONMENT == "production"
    smtp_ok = bool((settings.EMAIL_USER or "").strip() and (settings.EMAIL_PASSWORD or "").strip())
    admin_ok = bool((settings.PLATFORM_ADMIN_API_KEY or "").strip())
    cors = (settings.CORS_ORIGINS or "").strip()
    cors_ok = _cors_https_ok(cors, production)
    sk_ok = _ok_secret(settings.SECRET_KEY, 32)

    # Spec §6 — obrigatórios em produção
    asaas_env = (settings.ASAAS_ENVIRONMENT or "").strip().lower()
    asaas_env_ok = (asaas_env == "production") if production else True
    onboarding_ok = settings.asaas_onboarding_mode == "baas" if production else settings.asaas_onboarding_mode in (
        "baas",
        "linked",
        "both",
    )
    manual_wallet_ok = (not settings.ASAAS_ALLOW_MANUAL_WALLET) if production else True
    asaas_disabled_ok = (not settings.ASAAS_DISABLED) if production else True
    postgres_ok = _postgres_password_ok()

    asaas_ok = not settings.ASAAS_DISABLED and _ok_secret(settings.ASAAS_API_KEY, 20)
    asaas_wallet_ok = bool((settings.ASAAS_PLATFORM_WALLET_ID or "").strip())
    asaas_webhook = (settings.ASAAS_WEBHOOK_TOKEN or "").strip()
    asaas_webhook_ok = bool(asaas_webhook)

    asaas_platform_cnpj_ok: bool | None = None
    if (
        not settings.ASAAS_DISABLED
        and settings.use_asaas
        and settings.asaas_onboarding_mode in ("baas", "both")
        and not settings.asaas_e2e_mock
    ):
        from app.services.asaas_plataforma import plataforma_pode_provisionar_contas

        asaas_platform_cnpj_ok = plataforma_pode_provisionar_contas()

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

    payment_ok = asaas_ok
    payment_webhook_ok = asaas_webhook_ok or asaas_webhook_status in (
        "desativado_asaas",
        "dev_sem_token",
    )
    wallet_required = asaas_wallet_ok

    frontend_url_ok = bool((settings.FRONTEND_PUBLIC_URL or "").strip())

    asaas_platform_cnpj_required = (
        production
        and not settings.ASAAS_DISABLED
        and settings.use_asaas
        and settings.asaas_onboarding_mode in ("baas", "both")
        and not settings.asaas_e2e_mock
    )
    asaas_platform_cnpj_check_ok = (
        asaas_platform_cnpj_ok is True if asaas_platform_cnpj_required else True
    )

    ready = all(
        [
            sk_ok,
            cors_ok,
            admin_ok,
            smtp_ok,
            frontend_url_ok,
            payment_ok or settings.payments_disabled,
            payment_webhook_ok or settings.payments_disabled,
            wallet_required or settings.payments_disabled,
            asaas_env_ok or settings.payments_disabled,
            onboarding_ok,
            manual_wallet_ok,
            asaas_disabled_ok,
            postgres_ok,
            asaas_platform_cnpj_check_ok or settings.payments_disabled,
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
            "asaas_environment": "ok" if asaas_env_ok else "pendente",
            "asaas_onboarding_mode": "ok" if onboarding_ok else "pendente",
            "asaas_manual_wallet_off": "ok" if manual_wallet_ok else "pendente",
            "asaas_payments_enabled": "ok" if asaas_disabled_ok else "pendente",
            "asaas_platform_cnpj": (
                "ok"
                if asaas_platform_cnpj_ok is True
                else (
                    "desativado_asaas"
                    if settings.ASAAS_DISABLED
                    else (
                        "nao_aplicavel"
                        if not asaas_platform_cnpj_required
                        else ("pendente" if asaas_platform_cnpj_ok is False else "nao_verificado")
                    )
                )
            ),
            "smtp": "ok" if smtp_ok else "pendente",
            "platform_admin": "ok" if admin_ok else "pendente",
            "cors": "ok" if cors_ok else "pendente",
            "postgres_password": "ok" if postgres_ok else "pendente",
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
