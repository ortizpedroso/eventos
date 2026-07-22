"""E-mails do tracker de onboarding."""

from __future__ import annotations

from unittest.mock import patch

from app.models import Usuario
from app.services.onboarding_email import (
    _conta_repasse_url,
    enviar_email_assinatura_falhou,
)


def test_conta_repasse_url_codifica_tracking_id():
    url = _conta_repasse_url("acc/with spaces&x=1")
    assert "tracking=acc%2Fwith%20spaces%26x%3D1" in url
    assert "&quot;" not in url


def test_enviar_email_assinatura_falhou_idempotente():
    usuario = Usuario(
        id="u1",
        email="org@test.com",
        nome="Org",
        senha_hash="x",
        tipo="organizador",
        assinatura_tracker_status="PAYMENT_FAILED",
    )
    with patch("app.services.onboarding_email.enqueue_email_simples") as mock_email:
        ok = enviar_email_assinatura_falhou(usuario, motivos=["Falha no PIX"])
    assert ok is False
    mock_email.assert_not_called()


def test_enviar_email_assinatura_falhou_envia_uma_vez():
    usuario = Usuario(
        id="u1",
        email="org@test.com",
        nome="Org",
        senha_hash="x",
        tipo="organizador",
        assinatura_tracker_status="PAYMENT_PROCESSING",
    )
    with patch("app.services.onboarding_email.enqueue_email_simples", return_value=True) as mock_email:
        ok = enviar_email_assinatura_falhou(usuario, motivos=["Falha no PIX"])
    assert ok is True
    mock_email.assert_called_once()
    assert usuario.assinatura_tracker_status == "PAYMENT_FAILED"
