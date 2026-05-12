from config.database import Base, get_db, create_tables

# Importa modelos para registrá-los no Base
from app.models.usuario import Usuario
from app.models.evento import Evento
from app.models.ingresso import Ingresso
from app.models.cancelamento import Cancelamento
from app.models.stripe_event import StripeEvent

__all__ = [
    "Base",
    "get_db",
    "create_tables",
    "Usuario",
    "Evento",
    "Ingresso",
    "Cancelamento",
    "StripeEvent",
]
