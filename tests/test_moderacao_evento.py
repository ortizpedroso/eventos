"""Suspensão de evento pela plataforma e registro de IP/horário de acesso."""

from __future__ import annotations

import uuid
from contextlib import contextmanager
from datetime import datetime, timedelta
from unittest.mock import patch

import pytest

from fastapi.testclient import TestClient

from app.main import app
from app.models import RegistroAcesso, get_db
from app.services.registro_acesso import RETENCAO, apagar_registros_antigos
from config.settings import settings
from tests import test_api

ADMIN = {"X-Platform-Admin-Key": "chave-admin-teste"}
IP = "203.0.113.7"


def _visitante_ve(slug: str) -> int:
    return TestClient(app).get(f"/api/eventos/{slug}").status_code


@pytest.fixture(autouse=True)
def _ambiente(monkeypatch):
    monkeypatch.setattr(settings, "PLATFORM_ADMIN_API_KEY", "chave-admin-teste")
    monkeypatch.setattr(settings, "TRUST_FORWARDED_HEADERS", True)


@pytest.fixture
def emails():
    enviados: list[tuple[str, str]] = []

    def _enfileirar(destino: str, assunto: str, html: str) -> bool:
        enviados.append((destino, assunto + html))
        return True

    with patch("app.services.moderacao_evento.enqueue_email_simples", side_effect=_enfileirar):
        yield enviados


@contextmanager
def _db():
    gen = app.dependency_overrides[get_db]()
    db = next(gen)
    try:
        yield db
    finally:
        db.close()


def _organizador() -> tuple[dict[str, str], str]:
    email = f"mod-{uuid.uuid4().hex[:8]}@test.com"
    reg = test_api.client.post(
        "/api/auth/registrar",
        headers={"X-Forwarded-For": IP},
        json={"email": email, "nome": "Org", "senha": "senha12345", "tipo": "organizador"},
    )
    assert reg.status_code == 200, reg.text
    return {"Authorization": f"Bearer {reg.json()['access_token']}"}, reg.json()["usuario"]["id"]


def _evento_publicado(auth: dict[str, str]) -> dict:
    corpo = {
        "nome": f"Festa {uuid.uuid4().hex[:6]}",
        "descricao": "Festa",
        "data_inicio": "2027-03-01T20:00:00",
        "data_fim": "2027-03-01T23:00:00",
        "local": "Porto Alegre",
        "preco_ingresso": 0,
        "categoria": "Outros",
        "contato_telefone": "51999990000",
        "contato_email": "contato@festa.com",
        "publicado": True,
        "ingresso_lotes": [{"nome": "Geral", "preco": 0, "ordem": 1, "ativo": True, "tipo": "cortesia"}],
    }
    r = test_api.client.post("/api/eventos/criar", headers={**auth, "X-Forwarded-For": IP}, json=corpo)
    assert r.status_code == 200, r.text
    return {**r.json(), "_corpo": corpo}


def _suspender(evento_id: str, **extra):
    corpo = {"motivo": "ofensivo", "detalhe": "A imagem de capa tem conteúdo ofensivo.", **extra}
    return test_api.client.post(f"/api/admin/eventos/{evento_id}/suspender", headers=ADMIN, json=corpo)


def test_suspensao_tira_do_ar_avisa_e_trava_o_organizador(emails):
    auth, _ = _organizador()
    ev = _evento_publicado(auth)

    r = _suspender(ev["id"])
    assert r.status_code == 200, r.text
    assert r.json()["email_enviado"] is True

    assert _visitante_ve(ev["slug"]) == 404
    assert len(emails) == 1
    assert "Conteúdo ofensivo ou discriminatório" in emails[0][1]
    assert "A imagem de capa tem conteúdo ofensivo." in emails[0][1]

    publicar = test_api.client.patch(f"/api/eventos/id/{ev['id']}/publicado", headers=auth, json={"publicado": True})
    assert publicar.status_code == 403
    assert "suspenso" in publicar.json()["detail"]

    editar = test_api.client.patch(f"/api/eventos/id/{ev['id']}", headers=auth, json=ev["_corpo"])
    assert editar.status_code == 403
    assert test_api.client.post(f"/api/eventos/id/{ev['id']}/duplicar", headers=auth).status_code == 403

    admin_publicar = test_api.client.patch(
        f"/api/admin/eventos/{ev['id']}/publicado", headers=ADMIN, json={"publicado": True}
    )
    assert admin_publicar.status_code == 409

    meus = test_api.client.get("/api/eventos/meus", headers=auth).json()
    assert next(e for e in meus if e["id"] == ev["id"])["suspenso_motivo"] == "Conteúdo ofensivo ou discriminatório"

    lista = test_api.client.get("/api/admin/eventos", headers=ADMIN, params={"q": ev["slug"]}).json()["eventos"]
    assert lista[0]["suspenso_por"] == "chave de administrador"


def test_retirar_suspensao_devolve_o_controle_ao_organizador(emails):
    auth, _ = _organizador()
    ev = _evento_publicado(auth)
    assert _suspender(ev["id"]).status_code == 200

    r = test_api.client.post(f"/api/admin/eventos/{ev['id']}/reativar", headers=ADMIN)
    assert r.status_code == 200, r.text
    assert len(emails) == 2

    publicar = test_api.client.patch(f"/api/eventos/id/{ev['id']}/publicado", headers=auth, json={"publicado": True})
    assert publicar.status_code == 200, publicar.text
    assert _visitante_ve(ev["slug"]) == 200


@pytest.mark.parametrize("extra", [{"detalhe": "curto"}, {"motivo": "nao-existe"}])
def test_suspensao_exige_motivo_valido_e_explicacao(extra, emails):
    auth, _ = _organizador()
    ev = _evento_publicado(auth)
    assert _suspender(ev["id"], **extra).status_code == 422
    assert emails == []


def test_suspender_exige_administrador():
    auth, _ = _organizador()
    ev = _evento_publicado(auth)
    r = test_api.client.post(
        f"/api/admin/eventos/{ev['id']}/suspender",
        headers=auth,
        json={"motivo": "ofensivo", "detalhe": "Tentativa sem ser administrador."},
    )
    assert r.status_code in (401, 403)


def test_cadastro_login_e_publicacao_ficam_registrados_com_ip():
    auth, usuario_id = _organizador()
    ev = _evento_publicado(auth)
    login = test_api.client.post(
        "/api/auth/login",
        headers={"X-Forwarded-For": IP},
        json={"email": test_api.client.get("/api/auth/me", headers=auth).json()["email"], "senha": "senha12345"},
    )
    assert login.status_code == 200, login.text

    with _db() as db:
        registros = db.query(RegistroAcesso).filter_by(usuario_id=usuario_id).all()
    acoes = sorted(r.acao for r in registros)
    assert acoes == ["cadastro", "evento_criado", "evento_publicado", "login"]
    assert {r.ip for r in registros} == {IP}
    assert {r.referencia for r in registros if r.acao.startswith("evento")} == {ev["id"]}


def test_registros_mais_antigos_que_a_retencao_sao_apagados():
    agora = datetime(2027, 6, 1)
    with _db() as db:
        antigo = RegistroAcesso(acao="login", ip="1.1.1.1", criado_em=agora - RETENCAO - timedelta(days=1))
        recente = RegistroAcesso(acao="login", ip="1.1.1.1", criado_em=agora - timedelta(days=170))
        db.add_all([antigo, recente])
        db.commit()
        id_antigo, id_recente = antigo.id, recente.id
        apagar_registros_antigos(db, agora)
        db.commit()
        ids = {r.id for r in db.query(RegistroAcesso).filter(RegistroAcesso.id.in_([id_antigo, id_recente]))}
    assert ids == {id_recente}
