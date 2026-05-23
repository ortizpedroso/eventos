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

    # OAuth (Google Sign In)
    GOOGLE_OAUTH_CLIENT_ID: str = ""

    # JWT
    SECRET_KEY: str | None = None
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30

    # Email
    EMAIL_SERVER: str = "smtp.gmail.com"
    EMAIL_PORT: int = 587
    EMAIL_USER: str = ""
    EMAIL_PASSWORD: str = ""
    EMAIL_FROM_NAME: str = "EventosBR"
    # Links em e-mails e QR (ex.: http://localhost:3000)
    FRONTEND_PUBLIC_URL: str = "http://localhost:3000"

    # Redis (rate limit distribuído; opcional se indisponível)
    REDIS_URL: str = "redis://localhost:6379"
    # Em produção/staging: tentar Redis para rate limit; se falhar, usa memória do processo.
    RATE_LIMIT_USE_REDIS: bool = True
    # Fila de e-mail de ingresso via Redis (reinício da API não perde jobs); fallback em memória.
    TICKET_EMAIL_USE_REDIS: bool = True
    TICKET_EMAIL_MAX_ATTEMPTS: int = 3

    # CORS — evitar "*" por defeito (defina origens reais em produção).
    CORS_ORIGINS: str = "http://localhost:3000,http://127.0.0.1:3000,http://localhost:5173"

    # Só confiar em X-Forwarded-For quando a API estiver atrás de reverse proxy fidedigno.
    TRUST_FORWARDED_HEADERS: bool = False

    # Admin plataforma (exportação opt-in marketing; cabeçalho X-Platform-Admin-Key)
    PLATFORM_ADMIN_API_KEY: str = ""
    # Opcional: POST {telefone, nome, mensagem} para cada destinatário WhatsApp
    MARKETING_WHATSAPP_WEBHOOK_URL: str = ""
    # Opcional: Bearer enviado no header Authorization ao chamar o webhook acima
    MARKETING_WHATSAPP_WEBHOOK_TOKEN: str = ""

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


def _secret_key_strong() -> bool:
    v = (settings.SECRET_KEY or "").strip()
    weak = {
        "sua-chave-secreta-muito-segura-aqui-min32chars",
        "dev-insecure-checkin",
        "changeme",
    }
    return len(v) >= 32 and v not in weak


if settings.ENVIRONMENT not in ("development", "test") and not _secret_key_strong():
    raise RuntimeError(
        "SECRET_KEY fraca ou curta (mínimo 32 caracteres aleatórios fora de development/test)"
    )

# Força assinatura EBR1 no check-in fora de development/test.
CHECKIN_REQUIRE_SIGNED: bool = settings.ENVIRONMENT not in ("development", "test")
