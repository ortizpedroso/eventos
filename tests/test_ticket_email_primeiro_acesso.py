"""Item 1 (link do e-mail do ingresso quando a conta não tem senha ainda)."""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from unittest.mock import patch

from app.models import Evento, Ingresso, Usuario
from app.services import ticket_email
from app.services.auth import hash_password
from tests.test_api import TestingSessionLocal


def _agora():
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _criar_ingresso_pago(db, *, dono_senha_hash: str | None) -> Ingresso:
    suf = uuid.uuid4().hex[:8]
    org = Usuario(
        email=f"org.email.{suf}@test.com",
        nome="Org Email",
        senha_hash=hash_password("senha12345"),
        tipo="organizador",
    )
    dono = Usuario(
        email=f"dono.email.{suf}@test.com",
        nome="Dono Email",
        senha_hash=dono_senha_hash,
        tipo="cliente",
    )
    db.add_all([org, dono])
    db.commit()
    db.refresh(org)
    db.refresh(dono)

    ev = Evento(
        nome="Show Email",
        descricao="desc",
        data_inicio=_agora() + timedelta(days=3),
        data_fim=_agora() + timedelta(days=3, hours=2),
        local="Arena",
        cidade="SP",
        categoria="Shows",
        preco_ingresso=40.0,
        organizador_id=org.id,
        slug=f"show-email-{suf}",
        publicado=True,
    )
    db.add(ev)
    db.commit()
    db.refresh(ev)

    ing = Ingresso(
        evento_id=ev.id,
        usuario_id=dono.id,
        participante_nome="Participante Email",
        participante_email=dono.email,
        valor=40.0,
        status="pago",
    )
    db.add(ing)
    db.commit()
    db.refresh(ing)
    ing.evento = ev
    ing.usuario = dono
    return ing


def test_email_ingresso_conta_sem_senha_leva_para_criar_senha():
    db = TestingSessionLocal()
    try:
        ing = _criar_ingresso_pago(db, dono_senha_hash=None)
        html = ticket_email._build_html(ing, "cid123", db)
        assert "/auth?reset=" in html
        assert f"/conta/ingressos/{ing.id}" not in html
        assert "Criar senha e ver ingresso" in html
        assert "sua conta foi criada automaticamente".lower() in html.lower()

        db.refresh(ing.usuario)
        assert ing.usuario.senha_reset_token
    finally:
        db.close()


def test_email_ingresso_conta_com_senha_leva_direto_pra_conta():
    db = TestingSessionLocal()
    try:
        ing = _criar_ingresso_pago(db, dono_senha_hash=hash_password("senha12345"))
        html = ticket_email._build_html(ing, "cid123", db)
        assert f"/conta/ingressos/{ing.id}" in html
        assert "/auth?reset=" not in html
        assert "Ver ingresso na conta" in html
    finally:
        db.close()


def test_send_sync_usa_a_carteirinha_padrao_compartilhada():
    db = TestingSessionLocal()
    try:
        ing = _criar_ingresso_pago(db, dono_senha_hash=hash_password("senha12345"))
        ingresso_id = ing.id
    finally:
        db.close()

    with patch.object(ticket_email, "SessionLocal", TestingSessionLocal), patch.object(
        ticket_email, "smtp_configured", return_value=False
    ), patch.object(
        ticket_email, "montar_carteirinha_ingresso_bytes", wraps=ticket_email.montar_carteirinha_ingresso_bytes
    ) as mock_montar:
        ok = ticket_email._send_sync(ingresso_id)

    assert ok is False  # SMTP não configurado no ambiente de teste
    mock_montar.assert_called_once()
    assert mock_montar.call_args.args[0].id == ingresso_id
