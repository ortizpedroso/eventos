"""Galeria de edições anteriores — só fotos reais, max 6."""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone

import pytest

from app.models import Evento, Usuario
from app.services.evento_galeria import GALERIA_MAX, listar_urls, substituir_galeria
from tests import test_api


def test_galeria_max_e_substituicao():
    db = test_api.TestingSessionLocal()
    try:
        suf = uuid.uuid4().hex[:8]
        org = Usuario(email=f"org.gal.{suf}@test.com", nome="Org", senha_hash="x", tipo="organizador")
        db.add(org)
        db.commit()
        db.refresh(org)
        agora = datetime.now(timezone.utc).replace(tzinfo=None)
        ev = Evento(
            nome="Gal Evento",
            descricao="d",
            data_inicio=agora + timedelta(days=3),
            data_fim=agora + timedelta(days=3, hours=2),
            local="Sala",
            cidade="BH",
            categoria="Outros",
            preco_ingresso=20.0,
            organizador_id=org.id,
            slug=f"gal-evento-{suf}",
            publicado=True,
        )
        db.add(ev)
        db.commit()
        db.refresh(ev)

        assert listar_urls(db, ev.id) == []
        urls = [f"https://cdn.example.com/foto{i}.webp" for i in range(GALERIA_MAX)]
        out = substituir_galeria(db, ev, urls)
        assert len(out) == GALERIA_MAX
        assert listar_urls(db, ev.id) == urls

        with pytest.raises(ValueError, match="Máximo"):
            substituir_galeria(db, ev, urls + ["https://cdn.example.com/extra.webp"])

        # limpar
        assert substituir_galeria(db, ev, []) == []
        assert listar_urls(db, ev.id) == []
    finally:
        db.close()


def test_montar_evento_response_inclui_galeria():
    from app.schemas.evento import montar_evento_response

    db = test_api.TestingSessionLocal()
    try:
        suf = uuid.uuid4().hex[:8]
        org = Usuario(email=f"org.gal2.{suf}@test.com", nome="Org", senha_hash="x", tipo="organizador")
        db.add(org)
        db.commit()
        db.refresh(org)
        agora = datetime.now(timezone.utc).replace(tzinfo=None)
        ev = Evento(
            nome="Gal2",
            descricao="d",
            data_inicio=agora + timedelta(days=3),
            data_fim=agora + timedelta(days=3, hours=2),
            local="Sala",
            cidade="BH",
            categoria="Outros",
            preco_ingresso=20.0,
            organizador_id=org.id,
            slug=f"gal2-evento-{suf}",
            publicado=True,
        )
        db.add(ev)
        db.commit()
        db.refresh(ev)
        substituir_galeria(db, ev, ["https://cdn.example.com/a.webp"])
        resp = montar_evento_response(db, ev)
        assert resp.galeria_urls == ["https://cdn.example.com/a.webp"]
    finally:
        db.close()
