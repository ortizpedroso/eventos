from __future__ import annotations

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # Database
    DATABASE_URL: str = "sqlite:///./eventos.db"

    # Provedor de pagamento: asaas | stripe
    PAYMENT_PROVIDER: str = "asaas"

    # Stripe (legado / fallback)
    STRIPE_SECRET_KEY: str = ""
    STRIPE_PUBLISHABLE_KEY: str = ""
    STRIPE_WEBHOOK_SECRET: str = ""
    # true = cadastro e compra sem chamar a API Stripe (testes até a conta Stripe estar ok).
    STRIPE_DISABLED: bool = False
    # true = cadastro de organizador sem criar conta Connect (só Customer). Até aceitar termos em Settings > Connect.
    STRIPE_SKIP_CONNECT_ON_REGISTER: bool = False

    # Asaas (principal)
    ASAAS_API_KEY: str = ""
    ASAAS_WEBHOOK_TOKEN: str = ""
    # sandbox | production — se vazio, infere pela chave ($aact_prod_ = production)
    ASAAS_ENVIRONMENT: str = ""
    ASAAS_DISABLED: bool = False
    # walletId da conta EventosBR para split da taxa da plataforma
    ASAAS_PLATFORM_WALLET_ID: str = ""
    # Subconta no cadastro exige dados completos; padrão false (organizador informa wallet depois)
    ASAAS_CREATE_SUBACCOUNT_ON_REGISTER: bool = False
    # true = respostas mock da API Asaas (só development/test; E2E Playwright)
    ASAAS_E2E_MOCK: bool = False

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
    # STARTTLS na porta 587 (Gmail, Hostinger). false só para relay local sem TLS.
    EMAIL_USE_TLS: bool = True
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

    # Portaria: rotação automática do token (dias)
    PORTARIA_TOKEN_MAX_AGE_DAYS: int = 90
    PORTARIA_TOKEN_ROTATE_BEFORE_EVENT_DAYS: int = 7

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    def asaas_env(self) -> str:
        explicit = (self.ASAAS_ENVIRONMENT or "").strip().lower()
        if explicit in ("sandbox", "production", "prod"):
            return "production" if explicit in ("production", "prod") else "sandbox"
        key = (self.ASAAS_API_KEY or "").strip()
        if "$aact_prod_" in key or key.startswith("aact_prod_"):
            return "production"
        return "sandbox"

    @property
    def asaas_e2e_mock(self) -> bool:
        return self.ASAAS_E2E_MOCK and self.ENVIRONMENT in ("development", "test")

    @property
    def use_asaas(self) -> bool:
        if self.asaas_e2e_mock:
            return (self.PAYMENT_PROVIDER or "asaas").lower() == "asaas" and not self.ASAAS_DISABLED
        return (
            (self.PAYMENT_PROVIDER or "asaas").lower() == "asaas"
            and not self.ASAAS_DISABLED
            and bool((self.ASAAS_API_KEY or "").strip())
        )

    @property
    def use_stripe(self) -> bool:
        return (self.PAYMENT_PROVIDER or "").lower() == "stripe" and not self.STRIPE_DISABLED

    @property
    def asaas_base_url(self) -> str:
        return "https://api.asaas.com" if self.asaas_env() == "production" else "https://api-sandbox.asaas.com"

    @property
    def payments_disabled(self) -> bool:
        if self.use_asaas:
            return self.ASAAS_DISABLED
        return self.STRIPE_DISABLED

    @property
    def permite_ingresso_sem_gateway(self) -> bool:
        """Atalhos sem cobrança real — apenas development/test."""
        return self.ENVIRONMENT in ("development", "test")


settings = Settings()


if settings.ASAAS_DISABLED and settings.use_asaas:
    import logging as _logging

    _logging.getLogger(__name__).warning(
        "ASAAS_DISABLED está ativo: pagamentos Asaas desligados (modo teste local)."
    )

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
