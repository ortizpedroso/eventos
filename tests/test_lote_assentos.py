"""Assentos nomeados no lote (MVP) — claim atômico, carteirinha e compatibilidade."""

from __future__ import annotations

import os
import threading
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest
from PIL import Image
import io
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.main import app
from app.models import Base, get_db
from app.services.ingresso_qr import gerar_ticket_card_png_bytes
from app.services.lote_assentos import reservar_vaga_e_assento
from app.utils.lote_assentos import parse_assentos_texto
from tests.test_api import TestingSessionLocal, client

EDITOR = Path("frontend/src/components/evento-lotes-editor.tsx").read_text(encoding="utf-8")
COMPRAR = Path("frontend/src/components/comprar-ingresso.tsx").read_text(encoding="utf-8")


@pytest.fixture
def db_postgres_real():
    """SQLite (usado no resto da suíte, via tests/test_api.py) roda com StaticPool
    numa única conexão em memória e o dialeto SQLite do SQLAlchemy simplesmente
    DESCARTA a cláusula `FOR UPDATE` (sem suporte nativo a lock de linha) — ou
    seja, testes de concorrência real (duas threads, mesmo assento) não travam
    NADA contra SQLite e podem "passar" só por sorte de timing, sem verificar a
    trava de verdade. Este fixture troca get_db temporariamente pra um Postgres
    de verdade (onde FOR UPDATE bloqueia de verdade), só durante o teste que o
    usa, restaurando o override original no final."""
    url = os.environ.get("DATABASE_URL_TESTE_CONCORRENCIA") or os.environ.get(
        "DATABASE_URL_TESTE_POSTGRES"
    )
    if not url:
        pytest.skip(
            "DATABASE_URL_TESTE_CONCORRENCIA não configurada — teste de concorrência "
            "real exige Postgres (SQLite não suporta FOR UPDATE de verdade)."
        )
    engine = create_engine(url, pool_pre_ping=True)
    Base.metadata.create_all(bind=engine)
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

    def _override():
        db = SessionLocal()
        try:
            yield db
        finally:
            db.close()

    original = app.dependency_overrides.get(get_db)
    app.dependency_overrides[get_db] = _override
    try:
        yield engine
    finally:
        if original is not None:
            app.dependency_overrides[get_db] = original
        else:
            app.dependency_overrides.pop(get_db, None)
        Base.metadata.drop_all(bind=engine)
        engine.dispose()


def _agora():
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _registrar(tipo: str, suf: str) -> tuple[str, str]:
    email = f"{tipo}.assento.{suf}@test.com"
    r = client.post(
        "/api/auth/registrar",
        json={"email": email, "senha": "senha12345", "nome": tipo, "tipo": tipo},
    )
    assert r.status_code in (200, 201), r.text
    return r.json()["access_token"], email


def _criar_evento_com_assentos(tok: str, email: str, assentos: str = "A1, A2, B1") -> dict:
    payload = {
        "nome": f"Teatro {uuid.uuid4().hex[:6]}",
        "descricao": "Evento com assentos",
        "data_inicio": (_agora() + timedelta(days=5)).isoformat(),
        "data_fim": (_agora() + timedelta(days=5, hours=3)).isoformat(),
        "local": "Sala 1",
        "cidade": "SP",
        "contato_telefone": "11999998888",
        "contato_email": email,
        "preco_ingresso": 40.0,
        "categoria": "Cultura",
        "publicado": True,
        "ingresso_lotes": [
            {
                "nome": "Plateia",
                "preco": 40.0,
                "ordem": 1,
                "ativo": True,
                "quantidade_maxima": 10,
                "assentos": assentos,
            }
        ],
    }
    r = client.post(
        "/api/eventos/criar",
        headers={"Authorization": f"Bearer {tok}"},
        json=payload,
    )
    assert r.status_code == 200, r.text
    return r.json()


def test_ui_assentos_editor_e_checkout():
    assert "Assentos / lugares" in EDITOR
    assert "assentos_ocupados" in EDITOR
    assert 'id="assento-ingresso"' in COMPRAR
    assert "usaAssentos" in COMPRAR


def test_parse_assentos_texto():
    assert parse_assentos_texto("A1, A2, B1") == ["A1", "A2", "B1"]
    assert parse_assentos_texto("A1, A1, A2") == ["A1", "A2"]
    assert parse_assentos_texto("") == []
    try:
        parse_assentos_texto("assento com espaço")
        assert False, "deveria rejeitar"
    except ValueError:
        pass


def test_lote_sem_assentos_compra_por_quantidade_como_hoje():
    suf = uuid.uuid4().hex[:8]
    tok_org, email = _registrar("organizador", f"sem{suf}")
    tok_cli, _ = _registrar("cliente", f"semc{suf}")
    payload = {
        "nome": f"Sem assento {suf}",
        "descricao": "compat",
        "data_inicio": (_agora() + timedelta(days=3)).isoformat(),
        "data_fim": (_agora() + timedelta(days=3, hours=2)).isoformat(),
        "local": "Arena",
        "cidade": "SP",
        "contato_telefone": "11999998888",
        "contato_email": email,
        "preco_ingresso": 50.0,
        "categoria": "Música",
        "publicado": True,
        "ingresso_lotes": [
            {
                "nome": "Pista",
                "preco": 50.0,
                "ordem": 1,
                "ativo": True,
                "quantidade_maxima": 5,
            }
        ],
    }
    ev = client.post(
        "/api/eventos/criar",
        headers={"Authorization": f"Bearer {tok_org}"},
        json=payload,
    ).json()
    lote = ev["ingresso_lotes"][0]
    assert lote.get("assentos") in ([], None) or lote.get("assentos") == []

    r = client.post(
        "/api/pagamentos/criar",
        headers={"Authorization": f"Bearer {tok_cli}"},
        json={
            "evento_id": ev["id"],
            "lote_id": lote["id"],
            "quantidade": 2,
            "valor_centavos": 10000,
            "termo_compra_aceito": True,
        },
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["quantidade"] == 2
    assert body.get("assento") in (None, "")


def test_dois_compradores_mesmo_assento_so_um_consegue(db_postgres_real):
    suf = uuid.uuid4().hex[:8]
    tok_org, email = _registrar("organizador", f"race{suf}")
    tok_a, _ = _registrar("cliente", f"ra{suf}")
    tok_b, _ = _registrar("cliente", f"rb{suf}")
    ev = _criar_evento_com_assentos(tok_org, email, "A1, A2")
    lote_id = ev["ingresso_lotes"][0]["id"]
    evento_id = ev["id"]

    results: list[tuple[str, int, str]] = []
    barrier = threading.Barrier(2)

    def comprar(label: str, tok: str):
        barrier.wait(timeout=10)
        resp = client.post(
            "/api/pagamentos/criar",
            headers={"Authorization": f"Bearer {tok}"},
            json={
                "evento_id": evento_id,
                "lote_id": lote_id,
                "quantidade": 1,
                "valor_centavos": 4000,
                "assento": "A1",
                "termo_compra_aceito": True,
            },
        )
        results.append((label, resp.status_code, resp.text))

    t1 = threading.Thread(target=comprar, args=("a", tok_a))
    t2 = threading.Thread(target=comprar, args=("b", tok_b))
    t1.start()
    t2.start()
    t1.join(timeout=30)
    t2.join(timeout=30)

    oks = [r for r in results if r[1] == 200]
    fails = [r for r in results if r[1] != 200]
    assert len(results) == 2, results
    assert len(oks) == 1, results
    assert len(fails) == 1, results
    assert fails[0][1] == 400, fails[0]
    assert "assento" in fails[0][2].lower() or "reservado" in fails[0][2].lower()

    import json

    for _label, status, text in results:
        if status == 200:
            data = json.loads(text)
            assert data.get("assento") == "A1"


def test_assento_aparece_na_carteirinha_e_no_relatorio():
    suf = uuid.uuid4().hex[:8]
    tok_org, email = _registrar("organizador", f"card{suf}")
    tok_cli, _ = _registrar("cliente", f"cardc{suf}")
    ev = _criar_evento_com_assentos(tok_org, email, "Mesa-1, Mesa-2")
    lote = ev["ingresso_lotes"][0]
    assert "Mesa-1" in lote["assentos"]
    assert "Mesa-1" in lote["assentos_disponiveis"]

    r = client.post(
        "/api/pagamentos/criar",
        headers={"Authorization": f"Bearer {tok_cli}"},
        json={
            "evento_id": ev["id"],
            "lote_id": lote["id"],
            "quantidade": 1,
            "valor_centavos": 4000,
            "assento": "Mesa-1",
            "termo_compra_aceito": True,
        },
    )
    assert r.status_code == 200, r.text
    assert r.json()["assento"] == "Mesa-1"
    ing_id = r.json()["ingresso_id"]

    png = gerar_ticket_card_png_bytes(
        ingresso_id=ing_id,
        evento_nome=ev["nome"],
        data_local_fmt="01/08/2026 às 20:00",
        local="Sala 1",
        participante_nome="Participante",
        assento="Mesa-1",
    )
    img = Image.open(io.BytesIO(png))
    assert img.format == "PNG"
    # Com assento a carteirinha fica mais alta que sem
    png_sem = gerar_ticket_card_png_bytes(
        ingresso_id=ing_id,
        evento_nome=ev["nome"],
        data_local_fmt="01/08/2026 às 20:00",
        local="Sala 1",
        participante_nome="Participante",
    )
    assert Image.open(io.BytesIO(png)).height > Image.open(io.BytesIO(png_sem)).height

    det = client.get(
        f"/api/eventos/id/{ev['id']}",
        headers={"Authorization": f"Bearer {tok_org}"},
    )
    assert det.status_code == 200, det.text
    lote2 = det.json()["ingresso_lotes"][0]
    assert "Mesa-1" in lote2["assentos_ocupados"]
    assert "Mesa-1" not in lote2["assentos_disponiveis"]

    rel = client.get(
        "/api/relatorios/organizador/participantes",
        headers={"Authorization": f"Bearer {tok_org}"},
    )
    assert rel.status_code == 200, rel.text
    rows = rel.json()["participantes"]
    match = [p for p in rows if p.get("assento") == "Mesa-1"]
    assert match, rows

    meus = client.get(
        "/api/ingressos/meus",
        headers={"Authorization": f"Bearer {tok_cli}"},
    )
    assert meus.status_code == 200
    item = next(i for i in meus.json() if i["id"] == ing_id)
    assert item.get("assento") == "Mesa-1"


def test_claim_sequencial_service_layer():
    """Dois claims do mesmo assento na mesma sessão: só o primeiro passa após persistir ingresso."""
    suf = uuid.uuid4().hex[:8]
    tok_org, email = _registrar("organizador", f"svc{suf}")
    ev = _criar_evento_com_assentos(tok_org, email, "C1, C2")
    lote_id = ev["ingresso_lotes"][0]["id"]

    db = TestingSessionLocal()
    try:
        lote, codigo = reservar_vaga_e_assento(db, lote_id, quantidade=1, assento="C1")
        assert codigo == "C1"
        from app.models import Ingresso

        ing = Ingresso(
            evento_id=ev["id"],
            usuario_id=ev["organizador_id"],
            lote_id=lote.id,
            assento=codigo,
            canal_venda="online",
            participante_nome="X",
            valor=40.0,
            asaas_payment_id=f"t_{uuid.uuid4().hex}",
            status="pendente",
            reservado_ate=_agora() + timedelta(minutes=30),
        )
        db.add(ing)
        db.commit()

        try:
            reservar_vaga_e_assento(db, lote_id, quantidade=1, assento="C1")
            assert False, "segundo claim deveria falhar"
        except ValueError as e:
            assert "reservado" in str(e).lower() or "assento" in str(e).lower()
    finally:
        db.close()


def test_compra_exige_assento_quando_lote_tem_lista():
    suf = uuid.uuid4().hex[:8]
    tok_org, email = _registrar("organizador", f"req{suf}")
    tok_cli, _ = _registrar("cliente", f"reqc{suf}")
    ev = _criar_evento_com_assentos(tok_org, email, "Z1, Z2")
    lote_id = ev["ingresso_lotes"][0]["id"]
    r = client.post(
        "/api/pagamentos/criar",
        headers={"Authorization": f"Bearer {tok_cli}"},
        json={
            "evento_id": ev["id"],
            "lote_id": lote_id,
            "quantidade": 1,
            "valor_centavos": 4000,
            "termo_compra_aceito": True,
        },
    )
    assert r.status_code == 400, r.text
    assert "assento" in r.json()["detail"].lower()
