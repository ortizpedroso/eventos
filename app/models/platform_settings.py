"""Configurações globais da plataforma (singleton — base white-label)."""

from sqlalchemy import Column, DateTime, String, Text, func

from config.database import Base


class PlatformSettings(Base):
    __tablename__ = "platform_settings"

    id = Column(String(32), primary_key=True, default="default")
    site_name = Column(String(120), nullable=False, default="EventosBR")
    site_tagline = Column(String(255), nullable=True)
    footer_description = Column(Text, nullable=True)
    contact_email = Column(String(255), nullable=True)
    support_email = Column(String(255), nullable=True)
    logo_url = Column(Text, nullable=True)
    logo_light_url = Column(Text, nullable=True)
    favicon_url = Column(Text, nullable=True)
    primary_color = Column(String(7), nullable=False, default="#10b981")
    primary_color_dark = Column(String(7), nullable=False, default="#047857")
    social_instagram_url = Column(String(512), nullable=True)
    social_whatsapp_url = Column(String(512), nullable=True)
    social_linkedin_url = Column(String(512), nullable=True)
    social_x_url = Column(String(512), nullable=True)
    social_youtube_url = Column(String(512), nullable=True)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
