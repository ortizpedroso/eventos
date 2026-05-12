from sqlalchemy import Column, DateTime, String
from datetime import datetime, timezone

from config.database import Base


class StripeEvent(Base):
    __tablename__ = "stripe_events"

    id = Column(String, primary_key=True)  # Stripe event.id
    tipo = Column(String, nullable=False)
    data_recebimento = Column(DateTime, default=lambda: datetime.now(timezone.utc).replace(tzinfo=None))

    def __repr__(self):
        return f"<StripeEvent {self.id} {self.tipo}>"

