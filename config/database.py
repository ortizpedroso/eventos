from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from config.settings import settings
import logging

logger = logging.getLogger(__name__)

# Base para os modelos
Base = declarative_base()


def _redact_database_url(url: str) -> str:
    if "@" in url and "://" in url:
        scheme, rest = url.split("://", 1)
        if "@" in rest:
            creds, hostpart = rest.rsplit("@", 1)
            user = creds.split(":", 1)[0] if creds else "?"
            return f"{scheme}://{user}:***@{hostpart}"
    return url.split("://", 1)[0] + "://***" if "://" in url else "***"


def _sql_echo_enabled() -> bool:
    if settings.ENVIRONMENT in ("production", "staging"):
        return False
    return bool(settings.DEBUG)


# Engine
try:
    engine = create_engine(
        settings.DATABASE_URL,
        connect_args={"check_same_thread": False} if "sqlite" in settings.DATABASE_URL else {},
        echo=_sql_echo_enabled(),
    )
    logger.info(
        "Conexão com banco de dados estabelecida: %s",
        _redact_database_url(settings.DATABASE_URL),
    )
except Exception as e:
    logger.error("Erro ao conectar ao banco de dados: %s", e)
    raise

# Session
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def get_db():
    """Dependency para obter sessão do banco"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def create_tables():
    """Cria todas as tabelas"""
    Base.metadata.create_all(bind=engine)
