"""Testes do cliente SMTP compartilhado."""

from unittest.mock import MagicMock, patch

from app.services.smtp_client import (
    _SmtpMode,
    format_from_header,
    send_email,
    smtp_configured,
    smtp_use_ssl,
)


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


def test_smtp_use_ssl_port_465(monkeypatch):
    from config import settings as cfg

    monkeypatch.setattr(cfg.settings, "EMAIL_USE_SSL", False)
    monkeypatch.setattr(cfg.settings, "EMAIL_PORT", 465)
    assert smtp_use_ssl() is True


def test_smtp_use_ssl_explicit(monkeypatch):
    from config import settings as cfg

    monkeypatch.setattr(cfg.settings, "EMAIL_USE_SSL", True)
    monkeypatch.setattr(cfg.settings, "EMAIL_PORT", 587)
    assert smtp_use_ssl() is True


@patch("app.services.smtp_client._smtp_session")
def test_send_email_success(mock_session, monkeypatch):
    from config import settings as cfg

    monkeypatch.setattr(cfg.settings, "EMAIL_USER", "user@test.com")
    monkeypatch.setattr(cfg.settings, "EMAIL_PASSWORD", "secret")
    monkeypatch.setattr(cfg.settings, "EMAIL_USE_TLS", True)
    monkeypatch.setattr(cfg.settings, "EMAIL_USE_SSL", False)
    monkeypatch.setattr(cfg.settings, "EMAIL_PORT", 587)

    server = MagicMock()
    mock_session.return_value.__enter__.return_value = server

    ok = send_email(destino="a@b.com", assunto="Teste", corpo_texto="Olá", reply_to="remetente@b.com")
    assert ok is True
    server.login.assert_called_once()


@patch("app.services.smtp_client._smtp_session")
def test_send_email_fallback_second_mode(mock_session, monkeypatch):
    from config import settings as cfg

    monkeypatch.setattr(cfg.settings, "EMAIL_USER", "user@test.com")
    monkeypatch.setattr(cfg.settings, "EMAIL_PASSWORD", "secret")
    monkeypatch.setattr(cfg.settings, "EMAIL_USE_TLS", True)
    monkeypatch.setattr(cfg.settings, "EMAIL_USE_SSL", False)
    monkeypatch.setattr(cfg.settings, "EMAIL_PORT", 587)
    monkeypatch.setattr(cfg.settings, "EMAIL_SERVER", "smtp.hostinger.com")

    server = MagicMock()
    mock_session.side_effect = [
        Exception("primeira falha"),
        MagicMock(__enter__=MagicMock(return_value=server), __exit__=MagicMock(return_value=False)),
    ]

    ok = send_email(destino="a@b.com", assunto="Teste", corpo_texto="Olá")
    assert ok is True
    assert mock_session.call_count == 2
