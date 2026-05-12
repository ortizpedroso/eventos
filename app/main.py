import logging
from contextlib import asynccontextmanager

from dotenv import load_dotenv
from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from sqlalchemy.orm import Session

load_dotenv()

from app.routes import auth, eventos, ingressos, pagamentos, relatorios, webhooks
from app.models import create_tables, get_db
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
    sk = (settings.STRIPE_SECRET_KEY or "").strip()
    if settings.STRIPE_DISABLED:
        logger.warning("STRIPE_DISABLED ativo na API — cadastro e compras sem Stripe.")
    elif sk and (
        sk.endswith("aqui")
        or "seu_chave" in sk.lower()
        or "cole_aqui" in sk.lower()
        or len(sk) < 50
    ):
        logger.warning(
            "STRIPE_SECRET_KEY parece placeholder ou inválida (tamanho %s). "
            "No Windows, variável de ambiente do sistema pode SOBRESCREVER o .env — "
            "confira STRIPE_SECRET_KEY em Propriedades do sistema e reinicie a API.",
            len(sk),
        )
    if settings.ENVIRONMENT == "development":
        create_tables()
    yield


app = FastAPI(
    title="EventosBR API",
    description="Plataforma de eventos com reembolsos automáticos",
    version="1.0.0",
    lifespan=lifespan,
)

_origins = _cors_allow_origins()
app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_credentials=_origins != ["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api/auth", tags=["Autenticação"])
app.include_router(eventos.router, prefix="/api/eventos", tags=["Eventos"])
app.include_router(ingressos.router, prefix="/api/ingressos", tags=["Ingressos"])
app.include_router(pagamentos.router, prefix="/api/pagamentos", tags=["Pagamentos"])
app.include_router(relatorios.router, prefix="/api/relatorios", tags=["Relatórios"])
app.include_router(webhooks.router, prefix="/api/webhooks", tags=["Webhooks"])


@app.get("/health")
async def health(db: Session = Depends(get_db)):
    try:
        db.execute(text("SELECT 1"))
        return {
            "status": "ok",
            "database": "up",
            "message": "EventosBR API",
        }
    except Exception:
        return {
            "status": "degraded",
            "database": "down",
            "message": "EventosBR API",
        }


@app.get("/")
async def root():
    return {"message": "Bem-vindo à EventosBR API", "docs": "/docs"}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
