from config.database import Base, get_db, create_tables

# Importa modelos para registrá-los no Base
from app.models.usuario import Usuario
from app.models.evento import Evento
from app.models.ingresso import Ingresso
from app.models.evento_ingresso_lote import EventoIngressoLote
from app.models.cancelamento import Cancelamento
from app.models.webhook_event import WebhookEvent
from app.models.evento_cupom import EventoCupom
from app.models.campanha_marketing import CampanhaMarketing, CampanhaEnvio
from app.models.evento_lista_interesse import EventoListaInteresse
from app.models.evento_lista_espera import EventoListaEspera
from app.models.usuario_notificacao import UsuarioNotificacao
from app.models.financeiro_saque import FinanceiroSaque

__all__ = [
    "Base",
    "get_db",
    "create_tables",
    "Usuario",
    "Evento",
    "Ingresso",
    "EventoIngressoLote",
    "Cancelamento",
    "WebhookEvent",
    "EventoCupom",
    "CampanhaMarketing",
    "CampanhaEnvio",
    "EventoListaInteresse",
    "EventoListaEspera",
    "UsuarioNotificacao",
    "FinanceiroSaque",
]
