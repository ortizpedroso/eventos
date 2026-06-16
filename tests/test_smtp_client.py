"""Testes do cliente SMTP compartilhado."""

from unittest.mock import MagicMock, patch

from app.services.smtp_client import format_from_header, send_email, smtp_configured


def test_smtp_configured_false_when_empty(monkeypatch):
    from config import settings as cfg

    monkeypatch.setattr(cfg.settings, "EMAIL_USER", "")
    monkeypatch.setattr(cfg.settings, "EMAIL_PASSWORD", "")
    assert smtp_configured() is False


def test_format_from_header():
    from config import settings as cfg

    cfg.settings.EMAIL_FROM_NAME = "EventosBR"
    cfg.settings.EMAIL_USER = "noreply@test.com"
    assert "EventosBR" in format_from_header()
    assert "noreply@test.com" in format_from_header()


@patch("app.services.smtp_client.smtplib.SMTP")
def test_send_email_success(mock_smtp, monkeypatch):
    from config import settings as cfg

    monkeypatch.setattr(cfg.settings, "EMAIL_USER", "user@test.com")
    monkeypatch.setattr(cfg.settings, "EMAIL_PASSWORD", "secret")
    monkeypatch.setattr(cfg.settings, "EMAIL_USE_TLS", True)

    server = MagicMock()
    mock_smtp.return_value.__enter__.return_value = server

    ok = send_email(destino="a@b.com", assunto="Teste", corpo_texto="Olá")
    assert ok is True
    server.starttls.assert_called_once()
    server.login.assert_called_once()
