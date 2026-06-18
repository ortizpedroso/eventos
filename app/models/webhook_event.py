from sqlalchemy import Column, String, DateTime
from datetime import datetime, timezone
from config.database import Base


class WebhookEvent(Base):
    """Idempotência de webhooks de pagamento (Asaas)."""

    __tablename__ = "webhook_events"

    id = Column(String, primary_key=True)
    tipo = Column(String, nullable=False)
    data_recebimento = Column(
        DateTime,
        default=lambda: datetime.now(timezone.utc).replace(tzinfo=None),
    )
