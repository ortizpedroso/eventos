from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from config.settings import settings
import logging

logger = logging.getLogger(__name__)

# Base para os modelos
Base = declarative_base()

# Engine
try:
    engine = create_engine(
        settings.DATABASE_URL,
        connect_args={"check_same_thread": False} if "sqlite" in settings.DATABASE_URL else {},
        echo=settings.DEBUG
    )
    logger.info(f"✓ Conexão com banco de dados estabelecida: {settings.DATABASE_URL}")
except Exception as e:
    logger.error(f"✗ Erro ao conectar ao banco de dados: {e}")
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
