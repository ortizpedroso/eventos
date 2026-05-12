from __future__ import annotations

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # Database
    DATABASE_URL: str = "sqlite:///./eventos.db"

    # Stripe
    STRIPE_SECRET_KEY: str = ""
    STRIPE_PUBLISHABLE_KEY: str = ""
    STRIPE_WEBHOOK_SECRET: str = ""
    # true = cadastro e compra sem chamar a API Stripe (testes até a conta Stripe estar ok).
    STRIPE_DISABLED: bool = False
    # true = cadastro de organizador sem criar conta Connect (só Customer). Até aceitar termos em Settings > Connect.
    STRIPE_SKIP_CONNECT_ON_REGISTER: bool = False

    # JWT
    SECRET_KEY: str | None = None
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30

    # Email
    EMAIL_SERVER: str = "smtp.gmail.com"
    EMAIL_PORT: int = 587
    EMAIL_USER: str = ""
    EMAIL_PASSWORD: str = ""

    # Redis
    REDIS_URL: str = "redis://localhost:6379"

    # CORS (ex: "https://app.meudominio.com,https://admin.meudominio.com")
    CORS_ORIGINS: str = "*"

    # Ambiente
    DEBUG: bool = False
    ENVIRONMENT: str = "development"

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()

if settings.STRIPE_DISABLED:
    import logging as _logging

    _logging.getLogger(__name__).warning(
        "STRIPE_DISABLED está ativo: cadastro e pagamentos não usam a API Stripe. "
        "Não use em produção com dados reais."
    )

if settings.ENVIRONMENT != "development" and not settings.SECRET_KEY:
    raise RuntimeError("SECRET_KEY é obrigatório fora de development")
