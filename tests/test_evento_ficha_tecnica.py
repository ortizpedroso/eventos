"""Ficha técnica opcional do evento (classificação, o que levar, estacionamento)."""

from __future__ import annotations

import uuid
from pathlib import Path

from tests.test_api import client

FICHA_PUBLIC = Path("frontend/src/components/evento-ficha-tecnica.tsx").read_text(encoding="utf-8")
NOVO = Path("frontend/src/app/eventos/novo/novo-evento-client.tsx").read_text(encoding="utf-8")
EDITAR = Path("frontend/src/app/eventos/[slug]/editar/editar-client.tsx").read_text(encoding="utf-8")


def _registrar_org(suf: str) -> tuple[str, str]:
    email = f"org.ficha.{suf}@test.com"
    r = client.post(
        "/api/auth/registrar",
        json={"email": email, "senha": "senha12345", "nome": "Org Ficha", "tipo": "organizador"},
    )
    assert r.status_code in (200, 201), r.text
    return r.json()["access_token"], email


def _payload(**extra):
    base = {
        "nome": f"Show Ficha {uuid.uuid4().hex[:6]}",
        "descricao": "Descrição do show",
        "data_inicio": "2026-12-01T20:00:00",
        "data_fim": "2026-12-01T23:00:00",
        "local": "Arena SP",
        "cidade": "São Paulo",
        "contato_telefone": "11987654321",
        "contato_email": "contato@ficha.test",
        "preco_ingresso": 50,
        "categoria": "Música",
        "publicado": True,
        "ingresso_lotes": [{"nome": "Geral", "preco": 50, "ordem": 1, "ativo": True}],
    }
    base.update(extra)
    return base


def test_ficha_vazia_nao_quebra_e_campos_nulos():
    tok, email = _registrar_org(uuid.uuid4().hex[:8])
    headers = {"Authorization": f"Bearer {tok}"}
    r = client.post("/api/eventos/criar", headers=headers, json=_payload(contato_email=email))
    assert r.status_code == 200, r.text
    body = r.json()
    assert body.get("classificacao_etaria") in (None, "")
    assert body.get("o_que_levar") in (None, "")
    assert body.get("estacionamento") in (None, "")
    pub = client.get(f"/api/eventos/{body['slug']}")
    assert pub.status_code == 200
    assert pub.json().get("classificacao_etaria") in (None, "")
    assert "if (!idade && !levar && !park) return null" in FICHA_PUBLIC
    assert "Não informado" not in FICHA_PUBLIC


def test_ficha_preenchida_aparece_na_resposta_publica():
    tok, email = _registrar_org(uuid.uuid4().hex[:8])
    headers = {"Authorization": f"Bearer {tok}"}
    r = client.post(
        "/api/eventos/criar",
        headers=headers,
        json=_payload(
            contato_email=email,
            classificacao_etaria="16+",
            o_que_levar="Traga documento com foto",
            estacionamento="Estacionamento próprio gratuito",
        ),
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["classificacao_etaria"] == "16+"
    assert body["o_que_levar"] == "Traga documento com foto"
    assert body["estacionamento"] == "Estacionamento próprio gratuito"
    pub = client.get(f"/api/eventos/{body['slug']}")
    assert pub.status_code == 200
    assert pub.json()["classificacao_etaria"] == "16+"
    assert pub.json()["o_que_levar"] == "Traga documento com foto"


def test_classificacao_etaria_invalida_rejeitada():
    tok, email = _registrar_org(uuid.uuid4().hex[:8])
    headers = {"Authorization": f"Bearer {tok}"}
    r = client.post(
        "/api/eventos/criar",
        headers=headers,
        json=_payload(contato_email=email, classificacao_etaria="21+"),
    )
    assert r.status_code == 422


def test_formularios_tem_campos_ficha():
    assert "classificacao_etaria" in NOVO and "classificacao_etaria" in EDITAR
    assert "o_que_levar" in NOVO and "estacionamento" in EDITAR
    assert "Ficha técnica" in NOVO and "Ficha técnica" in EDITAR
