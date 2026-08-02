"""Item 2: formato do ingresso padronizado (carteirinha) entre e-mail, conta e impressão."""

from __future__ import annotations

import base64
import re
from datetime import datetime, timedelta, timezone

from app.models import Evento, Ingresso, Usuario
from app.services.auth import hash_password
from app.services.ingresso_qr import montar_carteirinha_ingresso_bytes
from tests.test_api import TestingSessionLocal, client


def _agora():
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _criar_conta_evento_ingresso(db, *, status="pago", suf="fmt"):
    org = Usuario(
        email=f"org.{suf}@test.com",
        nome="Org Fmt",
        senha_hash=hash_password("senha12345"),
        tipo="organizador",
    )
    cliente = Usuario(
        email=f"cli.{suf}@test.com",
        nome="Cli Fmt",
        senha_hash=hash_password("senha12345"),
        tipo="cliente",
    )
    db.add_all([org, cliente])
    db.commit()
    db.refresh(org)
    db.refresh(cliente)

    ev = Evento(
        nome="Show Fmt",
        descricao="desc",
        data_inicio=_agora() + timedelta(days=3),
        data_fim=_agora() + timedelta(days=3, hours=2),
        local="Arena",
        cidade="SP",
        categoria="Shows",
        preco_ingresso=40.0,
        organizador_id=org.id,
        slug=f"show-fmt-{suf}",
        publicado=True,
    )
    db.add(ev)
    db.commit()
    db.refresh(ev)

    ing = Ingresso(
        evento_id=ev.id,
        usuario_id=cliente.id,
        participante_nome="Cli Fmt",
        participante_email=cliente.email,
        valor=40.0,
        status=status,
    )
    db.add(ing)
    db.commit()
    db.refresh(ing)
    return cliente, ev, ing


def _login(email: str) -> str:
    r = client.post("/api/auth/login", json={"email": email, "senha": "senha12345"})
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


def test_carteirinha_endpoint_retorna_png_identico_a_montar_carteirinha():
    db = TestingSessionLocal()
    try:
        cliente, _ev, ing = _criar_conta_evento_ingresso(db, suf="png")
        esperado = montar_carteirinha_ingresso_bytes(ing)
        email, ingresso_id = cliente.email, ing.id
    finally:
        db.close()

    token = _login(email)
    resp = client.get(
        f"/api/ingressos/{ingresso_id}/carteirinha",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200, resp.text
    assert resp.headers["content-type"] == "image/png"
    assert resp.content == esperado


def test_download_html_embute_a_mesma_carteirinha_do_endpoint_dedicado():
    db = TestingSessionLocal()
    try:
        cliente, _ev, ing = _criar_conta_evento_ingresso(db, suf="down")
        esperado = montar_carteirinha_ingresso_bytes(ing)
        email, ingresso_id = cliente.email, ing.id
    finally:
        db.close()

    token = _login(email)
    resp = client.get(
        f"/api/ingressos/{ingresso_id}/download",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200, resp.text

    match = re.search(r'data:image/png;base64,([A-Za-z0-9+/=]+)"', resp.text)
    assert match, "carteirinha embutida em base64 não encontrada no HTML de impressão"
    embutida = base64.b64decode(match.group(1))
    assert embutida == esperado


def test_download_html_nao_repete_dados_da_carteirinha_em_texto():
    """Fora da <img>, o HTML de impressão não deve duplicar nome/data/local/participante."""
    db = TestingSessionLocal()
    try:
        cliente, ev, ing = _criar_conta_evento_ingresso(db, suf="semtexto")
        email, ingresso_id = cliente.email, ing.id
        ev_nome, local = ev.nome, ev.local
        participante = ing.participante_nome
    finally:
        db.close()

    token = _login(email)
    resp = client.get(
        f"/api/ingressos/{ingresso_id}/download",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200, resp.text
    html = resp.text

    for label in (
        "<p><strong>Participante:</strong>",
        "<p><strong>Email:</strong>",
        "<p><strong>Data:</strong>",
        "<p><strong>Local:</strong>",
        "<p><strong>Assento:</strong>",
    ):
        assert label not in html

    assert "<h2>" not in html
    assert "Ingresso Oficial" not in html
    assert "class=\"status\"" not in html

    body_match = re.search(r"<body[^>]*>(.*)</body>", html, re.DOTALL | re.IGNORECASE)
    assert body_match, "corpo HTML ausente"
    body_sem_img = re.sub(r"<img[^>]*>", "", body_match.group(1), flags=re.IGNORECASE)
    assert ev_nome not in body_sem_img
    assert participante not in body_sem_img
    assert local not in body_sem_img

    assert 'id="btn-imprimir"' in html
    assert "data:image/png;base64," in html


def test_carteirinha_endpoint_exige_ingresso_confirmado():
    db = TestingSessionLocal()
    try:
        cliente, _ev, ing = _criar_conta_evento_ingresso(db, status="pendente", suf="pend")
        email, ingresso_id = cliente.email, ing.id
    finally:
        db.close()

    token = _login(email)
    resp = client.get(
        f"/api/ingressos/{ingresso_id}/carteirinha",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 400, resp.text


def test_carteirinha_endpoint_e_apenas_do_dono_do_ingresso():
    db = TestingSessionLocal()
    try:
        _cliente, _ev, ing = _criar_conta_evento_ingresso(db, suf="dono")
        outro = Usuario(
            email="intruso.fmt@test.com",
            nome="Intruso",
            senha_hash=hash_password("senha12345"),
            tipo="cliente",
        )
        db.add(outro)
        db.commit()
        ingresso_id = ing.id
    finally:
        db.close()

    token = _login("intruso.fmt@test.com")
    resp = client.get(
        f"/api/ingressos/{ingresso_id}/carteirinha",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 404, resp.text
