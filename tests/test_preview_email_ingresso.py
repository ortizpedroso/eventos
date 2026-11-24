"""Prévia do e-mail de ingresso: sai com a marca do organizador e não cria ingresso."""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta

from app.models import Evento, Ingresso, Usuario
from app.models.evento_ingresso_lote import EventoIngressoLote
from scripts.preview_email_ingresso import ingresso_de_exemplo
from app.services.ticket_email import montar_email_ingresso
from tests.test_api import TestingSessionLocal


def _html(msg) -> str:
    for parte in msg.walk():
        if parte.get_content_type() == "text/html":
            return parte.get_payload(decode=True).decode()
    raise AssertionError("e-mail sem HTML")


def test_previa_usa_a_marca_do_organizador_sem_criar_ingresso():
    db = TestingSessionLocal()
    try:
        sufixo = uuid.uuid4().hex[:8]
        org = Usuario(
            email=f"prev-{sufixo}@example.com",
            nome="Cristiano",
            senha_hash="x",
            tipo="organizador",
            ativo=True,
            slug_publico=f"prev-{sufixo}",
            brand_name="Agência do Vale",
            brand_logo_url="https://eventosbr.app.br/uploads/org/x/logo.webp",
        )
        db.add(org)
        db.flush()
        evento = Evento(
            nome="Noite do Flashback",
            organizador_id=org.id,
            slug=f"noite-{sufixo}",
            data_inicio=datetime.now() + timedelta(days=10),
            data_fim=datetime.now() + timedelta(days=10, hours=6),
            local="Salão Comunitário",
            publicado=True,
        )
        db.add(evento)
        db.flush()
        db.add(EventoIngressoLote(evento_id=evento.id, nome="Antecipado", preco=20.0, ordem=0))
        db.flush()
        db.refresh(evento)
        antes = db.query(Ingresso).count()

        msg = montar_email_ingresso(ingresso_de_exemplo(evento, "dono@example.com"), db, "dono@example.com")

        html = _html(msg)
        assert msg["To"] == "dono@example.com"
        assert msg["Subject"].endswith("Agência do Vale")
        assert 'src="https://eventosbr.app.br/uploads/org/x/logo.webp"' in html
        assert "Ingresso emitido pela plataforma" in html
        assert "R$ 20,00" in html
        assert any(p.get_content_type() == "image/png" for p in msg.walk())
        assert db.query(Ingresso).count() == antes
    finally:
        db.rollback()
        db.close()
