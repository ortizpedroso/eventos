import logging
from contextlib import asynccontextmanager

from dotenv import load_dotenv
from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.orm import Session

load_dotenv()

from app.routes import admin, auth, checkin, eventos, financeiro, ingressos, listas, notificacoes, organizador, pagamentos, portaria, produtor, relatorios, simuladores, webhooks
from app.models import create_tables, get_db
from app.middleware.request_id import RequestIdMiddleware
from config.settings import settings

logger = logging.getLogger(__name__)


def _cors_allow_origins() -> list[str]:
    raw = (settings.CORS_ORIGINS or "").strip()
    if not raw or raw == "*":
        return ["*"]
    return [o.strip() for o in raw.split(",") if o.strip()]


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Em produção, migrações (Alembic) devem rodar antes de subir a API.
    if settings.ASAAS_DISABLED:
        logger.warning("ASAAS_DISABLED ativo na API — pagamentos Asaas desligados.")
    elif settings.use_asaas:
        key = (settings.ASAAS_API_KEY or "").strip()
        if not key:
            logger.warning("ASAAS_API_KEY ausente.")
        if not (settings.ASAAS_PLATFORM_WALLET_ID or "").strip():
            logger.warning("ASAAS_PLATFORM_WALLET_ID ausente — split da plataforma não funcionará.")
        if not (settings.ASAAS_WEBHOOK_TOKEN or "").strip() and settings.ENVIRONMENT == "production":
            logger.warning("ASAAS_WEBHOOK_TOKEN ausente — webhook Asaas sem autenticação em produção.")
    if settings.ENVIRONMENT == "development":
        create_tables()
    if settings.ENVIRONMENT == "production":
        cors = (settings.CORS_ORIGINS or "").strip()
        if not cors or cors == "*":
            logger.warning(
                "CORS_ORIGINS está vazio ou '*' em produção — defina origens explícitas (URLs do front)."
            )
    from app.services.production_checks import log_production_warnings
    from app.services.ticket_email import start_ticket_email_worker, stop_ticket_email_worker
    from app.services.lembrete_evento import start_lembrete_worker, stop_lembrete_worker
    from app.services.lista_espera_cleanup import (
        start_lista_espera_cleanup_worker,
        stop_lista_espera_cleanup_worker,
    )
    from app.services.reserva_cleanup import start_reserva_cleanup_worker, stop_reserva_cleanup_worker
    from app.services.assinatura_ciclo import start_assinatura_ciclo_worker, stop_assinatura_ciclo_worker
    from app.services.repasse_status_sync import (
        start_repasse_status_sync_worker,
        stop_repasse_status_sync_worker,
    )

    log_production_warnings()
    start_ticket_email_worker()
    start_reserva_cleanup_worker()
    start_lista_espera_cleanup_worker()
    start_lembrete_worker()
    start_assinatura_ciclo_worker()
    start_repasse_status_sync_worker()
    try:
        yield
    finally:
        stop_repasse_status_sync_worker()
        stop_assinatura_ciclo_worker()
        stop_lembrete_worker()
        stop_lista_espera_cleanup_worker()
        stop_reserva_cleanup_worker()
        stop_ticket_email_worker()


_docs_on = settings.ENVIRONMENT == "development"

app = FastAPI(
    title="EventosBR API",
    description="Plataforma de eventos com reembolsos automáticos",
    version="1.0.0",
    lifespan=lifespan,
    redirect_slashes=False,
    docs_url="/docs" if _docs_on else None,
    redoc_url="/redoc" if _docs_on else None,
    openapi_url="/openapi.json" if _docs_on else None,
)

_origins = _cors_allow_origins()
app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_credentials=_origins != ["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_middleware(RequestIdMiddleware)

app.include_router(auth.router, prefix="/api/auth", tags=["Autenticação"])
app.include_router(eventos.router, prefix="/api/eventos", tags=["Eventos"])
app.include_router(ingressos.router, prefix="/api/ingressos", tags=["Ingressos"])
app.include_router(pagamentos.router, prefix="/api/pagamentos", tags=["Pagamentos"])
app.include_router(relatorios.router, prefix="/api/relatorios", tags=["Relatórios"])
app.include_router(checkin.router, prefix="/api/checkin", tags=["Check-in"])
app.include_router(portaria.router, prefix="/api/portaria", tags=["Portaria"])
app.include_router(organizador.router, prefix="/api/organizador", tags=["Organizador"])
app.include_router(financeiro.router, prefix="/api/organizador/financeiro", tags=["Financeiro"])
app.include_router(listas.router, prefix="/api/listas", tags=["Listas"])
app.include_router(notificacoes.router, prefix="/api/notificacoes", tags=["Notificações"])
app.include_router(produtor.router, prefix="/api/produtor", tags=["Produtor"])
app.include_router(simuladores.router, prefix="/api/simuladores", tags=["Simuladores"])
app.include_router(admin.router, prefix="/api/admin", tags=["Admin"])
app.include_router(webhooks.router, prefix="/api/webhooks", tags=["Webhooks"])


@app.get("/health")
async def health():
    """Liveness: o processo HTTP responde (orquestradores não devem reiniciar por falha de BD)."""
    return {
        "status": "ok",
        "role": "liveness",
        "message": "EventosBR API",
    }


@app.get("/ready")
async def ready(db: Session = Depends(get_db)):
    """Readiness: aplicação aceita tráfego (inclui verificação à base de dados)."""
    try:
        db.execute(text("SELECT 1"))
        return JSONResponse(
            status_code=200,
            content={
                "status": "ok",
                "role": "readiness",
                "database": "up",
                "message": "EventosBR API",
            },
        )
    except Exception:
        logger.error("Readiness falhou: base de dados indisponível", exc_info=True)
        return JSONResponse(
            status_code=503,
            content={
                "status": "unavailable",
                "role": "readiness",
                "database": "down",
                "message": "EventosBR API",
            },
        )


@app.get("/")
async def root():
    msg = "Bem-vindo à EventosBR API"
    if _docs_on:
        return {"message": msg, "docs": "/docs"}
    return {"message": msg}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
