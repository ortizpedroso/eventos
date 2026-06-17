"""Testes patamar completo UX/produto."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

import pytest
from slugify import slugify

from app.models import Evento, Ingresso, Usuario
from app.services.eventos_relacionados import listar_eventos_relacionados
from app.services.ingresso_pago import marcar_ingresso_pago
from app.services.lista_espera import (
    expirar_tokens_vencidos,
    inscrever_espera,
    janela_exclusiva_espera_ativa,
    liberar_vagas_apos_cancelamento,
    validar_token_espera,
)
from app.services.lista_interesse import inscrever_interesse
from app.services.taxas_asaas_publicas import calcular_taxa_asaas, simular_parcelas
from app.services.urgencia import calcular_urgencia
from tests import test_api


def _db():
    return test_api.TestingSessionLocal()


def _criar_evento(db, org_id: str, nome: str = "Show Teste") -> Evento:
    ev = Evento(
        nome=nome,
        descricao="desc",
        data_inicio=datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(days=7),
        data_fim=datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(days=7, hours=3),
        local="Rua A, 1",
        cidade="São Paulo",
        categoria="Shows",
        preco_ingresso=50.0,
        organizador_id=org_id,
        slug=slugify(f"{nome}-{org_id[:8]}"),
        publicado=True,
        aceita_interesse=True,
        lista_espera_habilitada=True,
    )
    db.add(ev)
    db.commit()
    db.refresh(ev)
    return ev


def _criar_org(db) -> Usuario:
    org = Usuario(
        email=f"org-{slugify(str(datetime.now().timestamp()))}@ex.com",
        nome="Org Teste",
        senha_hash="x",
        tipo="organizador",
    )
    db.add(org)
    db.commit()
    db.refresh(org)
    return org


def test_taxas_asaas_pix():
    assert calcular_taxa_asaas(100.0, "pix") == 1.99


def test_simular_parcelas():
    r = simular_parcelas(120.0, 3)
    assert r["parcelas"] == 3
    assert r["valor_parcela"] == 40.0


def test_urgencia_exato():
    b = calcular_urgencia("exato", restantes=7)
    assert b.ativo and "7" in (b.texto or "")


def test_urgencia_sem_estoque_conhecido():
    b = calcular_urgencia("exato", restantes=None)
    assert not b.ativo
    b2 = calcular_urgencia("faixa", restantes=None)
    assert not b2.ativo


def test_lista_interesse_dedup():
    db = _db()
    try:
        org = _criar_org(db)
        ev = _criar_evento(db, org.id)
        a = inscrever_interesse(db, ev, email="teste@exemplo.com", nome="A")
        b = inscrever_interesse(db, ev, email="teste@exemplo.com", nome="B")
        assert a.id == b.id
    finally:
        db.close()


def test_lista_espera_fifo():
    db = _db()
    try:
        org = _criar_org(db)
        ev = _criar_evento(db, org.id)
        e1 = inscrever_espera(db, ev, email="a@ex.com", nome="A")
        e2 = inscrever_espera(db, ev, email="b@ex.com", nome="B")
        assert e1.posicao == 1
        assert e2.posicao == 2
    finally:
        db.close()


def test_lista_espera_liberacao(monkeypatch):
    db = _db()
    try:
        org = _criar_org(db)
        ev = _criar_evento(db, org.id)
        ev.lista_espera_prazo_horas = 24
        db.commit()
        entrada = inscrever_espera(db, ev, email="fila@ex.com")
        emails: list[str] = []
        monkeypatch.setattr(
            "app.services.lista_espera.enqueue_email_simples",
            lambda dest, subj, html: emails.append(dest) or True,
        )
        n = liberar_vagas_apos_cancelamento(db, ev.id, 1)
        assert n == 1
        db.refresh(entrada)
        assert entrada.status == "notificado"
        assert entrada.token_compra
        assert emails == ["fila@ex.com"]
        ok = validar_token_espera(db, ev, entrada.token_compra)
        assert ok is not None
    finally:
        db.close()


def test_lista_espera_marcada_comprada_apos_pagamento():
    db = _db()
    try:
        org = _criar_org(db)
        ev = _criar_evento(db, org.id)
        entrada = inscrever_espera(db, ev, email="comprador@ex.com")
        entrada.status = "notificado"
        entrada.token_compra = "tok-test"
        db.commit()
        ing = Ingresso(
            evento_id=ev.id,
            usuario_id=org.id,
            participante_email="comprador@ex.com",
            valor=50.0,
            status="pendente",
        )
        db.add(ing)
        db.commit()
        db.refresh(ing)
        assert marcar_ingresso_pago(db, ing)
        db.commit()
        db.refresh(entrada)
        assert entrada.status == "comprado"
        assert entrada.token_compra is None
    finally:
        db.close()


def test_lista_espera_expiracao_token(monkeypatch):
    db = _db()
    try:
        org = _criar_org(db)
        ev = _criar_evento(db, org.id)
        ev.lista_espera_prazo_horas = 24
        db.commit()
        e1 = inscrever_espera(db, ev, email="a@ex.com")
        e2 = inscrever_espera(db, ev, email="b@ex.com")
        monkeypatch.setattr(
            "app.services.lista_espera.enqueue_email_simples",
            lambda dest, subj, html: True,
        )
        liberar_vagas_apos_cancelamento(db, ev.id, 1)
        db.refresh(e1)
        assert e1.status == "notificado"
        e1.token_expira_em = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(hours=1)
        db.commit()
        n = expirar_tokens_vencidos(db)
        assert n >= 1
        db.refresh(e1)
        assert e1.status == "expirado"
        db.refresh(e2)
        assert e2.status == "notificado"
    finally:
        db.close()


def test_eventos_relacionados_prioridade_organizador():
    db = _db()
    try:
        org = _criar_org(db)
        ev = _criar_evento(db, org.id, "Evento base")
        outro = Evento(
            nome="Outro do mesmo org",
            descricao="d",
            data_inicio=ev.data_inicio + timedelta(days=1),
            data_fim=ev.data_fim + timedelta(days=1),
            local="Local",
            cidade=ev.cidade,
            categoria=ev.categoria,
            preco_ingresso=20,
            organizador_id=ev.organizador_id,
            slug=slugify("outro-org-test"),
            publicado=True,
        )
        db.add(outro)
        db.commit()
        rel = listar_eventos_relacionados(db, ev, limite=4)
        assert any(r.organizador_id == ev.organizador_id for r in rel)
    finally:
        db.close()


def test_janela_exclusiva_espera():
    db = _db()
    try:
        org = _criar_org(db)
        ev = _criar_evento(db, org.id)
        assert not janela_exclusiva_espera_ativa(db, ev.id)
        entrada = inscrever_espera(db, ev, email="fila@ex.com")
        entrada.status = "notificado"
        entrada.token_compra = "tok-janela"
        entrada.token_expira_em = datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(hours=24)
        db.commit()
        assert janela_exclusiva_espera_ativa(db, ev.id)
    finally:
        db.close()


def test_validar_compra_com_token_espera():
    import pytest
    from fastapi import HTTPException

    from app.services.lista_espera import validar_compra_com_token_espera

    db = _db()
    try:
        org = _criar_org(db)
        ev = _criar_evento(db, org.id)
        entrada = inscrever_espera(db, ev, email="comprador@ex.com")
        entrada.status = "notificado"
        entrada.token_compra = "tok-compra"
        entrada.token_expira_em = datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(hours=24)
        db.commit()
        with pytest.raises(HTTPException) as exc:
            validar_compra_com_token_espera(db, ev, None, "comprador@ex.com")
        assert exc.value.status_code == 403
        validar_compra_com_token_espera(db, ev, "tok-compra", "comprador@ex.com")
    finally:
        db.close()


def test_cancelar_pendentes_libera_lista_espera(monkeypatch):
    db = _db()
    try:
        org = _criar_org(db)
        ev = _criar_evento(db, org.id)
        fila = inscrever_espera(db, ev, email="proximo@ex.com")
        ing = Ingresso(
            evento_id=ev.id,
            usuario_id=org.id,
            participante_email="outro@ex.com",
            valor=50.0,
            status="pendente",
            asaas_payment_id="pay_cleanup",
        )
        db.add(ing)
        db.commit()
        emails: list[str] = []
        monkeypatch.setattr(
            "app.services.lista_espera.enqueue_email_simples",
            lambda dest, subj, html: emails.append(dest) or True,
        )
        from app.services.ingresso_pago import cancelar_ingressos_pi_pendentes

        n = cancelar_ingressos_pi_pendentes(db, "pay_cleanup")
        assert n == 1
        db.refresh(fila)
        assert fila.status == "notificado"
        assert emails == ["proximo@ex.com"]
    finally:
        db.close()


def test_cancelar_reembolsados_marca_pago_como_cancelado():
    db = _db()
    try:
        org = _criar_org(db)
        ev = _criar_evento(db, org.id)
        ing = Ingresso(
            evento_id=ev.id,
            usuario_id=org.id,
            valor=50.0,
            status="pago",
            asaas_payment_id="pay_refund",
        )
        db.add(ing)
        db.commit()
        db.refresh(ing)
        from app.services.ingresso_pago import cancelar_ingressos_reembolsados

        n = cancelar_ingressos_reembolsados(db, "pay_refund")
        assert n == 1
        db.commit()
        db.refresh(ing)
        assert ing.status == "cancelado"
    finally:
        db.close()


def test_api_lista_interesse():
    db = _db()
    try:
        org = _criar_org(db)
        ev = _criar_evento(db, org.id)
        r = test_api.client.post(
            f"/api/listas/interesse/{ev.slug}",
            json={"email": "novo@exemplo.com", "nome": "Test"},
        )
        assert r.status_code == 200
        assert r.json()["ok"] is True
    finally:
        db.close()


def test_api_simuladores():
    r = test_api.client.get("/api/simuladores/simular", params={"preco": 50, "metodo": "pix"})
    assert r.status_code == 200
    data = r.json()
    assert data["preco_bruto"] == 50
    assert "aviso_legal" in data
