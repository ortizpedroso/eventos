"""Lembrete de carrinho abandonado (transacional, one-shot, 20 min)."""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from unittest.mock import patch

from app.models import Evento, Ingresso, Usuario
from app.services.lembrete_carrinho import (
    CARRINHO_LEMBRETE_APOS_MINUTOS,
    candidatos_carrinho_abandonado,
    enviar_lembretes_carrinho,
)
from tests import test_api


def _agora():
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _setup(db):
    suf = uuid.uuid4().hex[:10]
    org = Usuario(email=f"org.carrinho.{suf}@test.com", nome="Org", senha_hash="x", tipo="organizador")
    buyer = Usuario(
        email=f"buyer.carrinho.{suf}@test.com", nome="Buyer", senha_hash="x", tipo="cliente"
    )
    db.add_all([org, buyer])
    db.commit()
    db.refresh(org)
    db.refresh(buyer)
    agora = _agora()
    ev = Evento(
        nome=f"Show Carrinho {suf}",
        descricao="d",
        data_inicio=agora + timedelta(days=10),
        data_fim=agora + timedelta(days=10, hours=2),
        local="Arena",
        cidade="SP",
        categoria="Música",
        preco_ingresso=50.0,
        organizador_id=org.id,
        slug=f"show-carrinho-{suf}",
        publicado=True,
    )
    db.add(ev)
    db.commit()
    db.refresh(ev)
    return org, buyer, ev


def test_constante_20_minutos():
    assert CARRINHO_LEMBRETE_APOS_MINUTOS == 20


def test_candidato_apos_20_min_com_reserva_ativa():
    db = test_api.TestingSessionLocal()
    try:
        _, buyer, ev = _setup(db)
        agora = _agora()
        ing = Ingresso(
            evento_id=ev.id,
            usuario_id=buyer.id,
            participante_nome="Buyer",
            participante_email=buyer.email,
            valor=50.0,
            status="pendente",
            data_compra=agora - timedelta(minutes=21),
            reservado_ate=agora + timedelta(minutes=14),
        )
        db.add(ing)
        db.commit()
        cands = candidatos_carrinho_abandonado(db, agora=agora)
        assert any(c.id == ing.id for c in cands)
    finally:
        db.close()


def test_nao_candidato_se_ainda_cedo_ou_reserva_expirou_ou_pago():
    db = test_api.TestingSessionLocal()
    try:
        _, buyer, ev = _setup(db)
        agora = _agora()
        cedo = Ingresso(
            evento_id=ev.id,
            usuario_id=buyer.id,
            participante_email="a@test.com",
            valor=50.0,
            status="pendente",
            data_compra=agora - timedelta(minutes=5),
            reservado_ate=agora + timedelta(minutes=30),
        )
        expirado = Ingresso(
            evento_id=ev.id,
            usuario_id=buyer.id,
            participante_email="b@test.com",
            valor=50.0,
            status="pendente",
            data_compra=agora - timedelta(minutes=30),
            reservado_ate=agora - timedelta(minutes=1),
        )
        pago = Ingresso(
            evento_id=ev.id,
            usuario_id=buyer.id,
            participante_email="c@test.com",
            valor=50.0,
            status="pago",
            data_compra=agora - timedelta(minutes=25),
            reservado_ate=agora + timedelta(minutes=10),
        )
        db.add_all([cedo, expirado, pago])
        db.commit()
        ids = {c.id for c in candidatos_carrinho_abandonado(db, agora=agora)}
        assert cedo.id not in ids
        assert expirado.id not in ids
        assert pago.id not in ids
    finally:
        db.close()


def test_envia_uma_vez_por_grupo_e_marca_one_shot():
    db = test_api.TestingSessionLocal()
    try:
        _, buyer, ev = _setup(db)
        agora = _agora()
        res = agora + timedelta(minutes=12)
        compra = agora - timedelta(minutes=22)
        pay_id = f"pay_lote_{uuid.uuid4().hex[:8]}"
        a = Ingresso(
            evento_id=ev.id,
            usuario_id=buyer.id,
            participante_email=buyer.email,
            valor=50.0,
            status="pendente",
            data_compra=compra,
            reservado_ate=res,
            asaas_payment_id=pay_id,
        )
        b = Ingresso(
            evento_id=ev.id,
            usuario_id=buyer.id,
            participante_email=buyer.email,
            valor=50.0,
            status="pendente",
            data_compra=compra,
            reservado_ate=res,
            asaas_payment_id=pay_id,
        )
        db.add_all([a, b])
        db.commit()

        with patch("app.services.lembrete_carrinho.enqueue_email_simples", return_value=True) as enq:
            with patch("app.services.lembrete_carrinho.SessionLocal", return_value=db):
                # SessionLocal().close() no finally — usar mesma sessão via side effect
                pass

        # Chama lógica com session real via monkeypatch de SessionLocal
        sessions = []

        def _sl():
            s = test_api.TestingSessionLocal()
            sessions.append(s)
            return s

        with patch("app.services.lembrete_carrinho.SessionLocal", side_effect=_sl):
            with patch("app.services.lembrete_carrinho.enqueue_email_simples", return_value=True) as enq:
                n = enviar_lembretes_carrinho()
        assert n >= 1
        # Um e-mail por grupo (qty=2 com mesmo payment_id → 1 envio para este lote)
        htmls = [c[0][2] for c in enq.call_args_list]
        assert any("retomar=" in h and "/conta/perfil" in h for h in htmls)
        mensagens_deste_evento = sum(1 for h in htmls if ev.slug in h)
        assert mensagens_deste_evento == 1

        db2 = test_api.TestingSessionLocal()
        try:
            rows = db2.query(Ingresso).filter(Ingresso.asaas_payment_id == pay_id).all()
            assert len(rows) == 2
            assert all(r.carrinho_lembrete_enviado_em is not None for r in rows)
        finally:
            db2.close()

        with patch("app.services.lembrete_carrinho.SessionLocal", side_effect=_sl):
            with patch("app.services.lembrete_carrinho.enqueue_email_simples", return_value=True) as enq2:
                enviar_lembretes_carrinho()
        # Este lote não gera novo e-mail
        htmls2 = [c[0][2] for c in enq2.call_args_list]
        assert not any(ev.slug in h for h in htmls2)
        for s in sessions:
            s.close()
    finally:
        db.close()


def test_idempotente_segundo_cron_nao_reenvia_na_janela_da_reserva():
    """Mesmo com reserva ainda válida, um segundo ciclo do worker não reenvia."""
    db = test_api.TestingSessionLocal()
    try:
        _, buyer, ev = _setup(db)
        agora = _agora()
        ing = Ingresso(
            evento_id=ev.id,
            usuario_id=buyer.id,
            participante_email=buyer.email,
            valor=50.0,
            status="pendente",
            data_compra=agora - timedelta(minutes=22),
            reservado_ate=agora + timedelta(minutes=13),
        )
        db.add(ing)
        db.commit()
        ingresso_id = ing.id

        sessions: list = []

        def _sl():
            s = test_api.TestingSessionLocal()
            sessions.append(s)
            return s

        with patch("app.services.lembrete_carrinho.SessionLocal", side_effect=_sl):
            with patch("app.services.lembrete_carrinho.enqueue_email_simples", return_value=True) as enq1:
                n1 = enviar_lembretes_carrinho()
        assert n1 >= 1
        assert sum(1 for c in enq1.call_args_list if ev.slug in c[0][2]) == 1

        db_check = test_api.TestingSessionLocal()
        try:
            row = db_check.get(Ingresso, ingresso_id)
            assert row is not None
            assert row.carrinho_lembrete_enviado_em is not None
            assert row.status == "pendente"
            assert row.reservado_ate > _agora()
        finally:
            db_check.close()

        with patch("app.services.lembrete_carrinho.SessionLocal", side_effect=_sl):
            with patch("app.services.lembrete_carrinho.enqueue_email_simples", return_value=True) as enq2:
                n2 = enviar_lembretes_carrinho()
        assert sum(1 for c in enq2.call_args_list if ev.slug in c[0][2]) == 0
        # Pode haver outros candidatos no DB compartilhado; este checkout não pode estar entre eles
        assert n2 >= 0
        for s in sessions:
            s.close()
    finally:
        db.close()


def test_claim_falha_enqueue_libera_para_retry():
    db = test_api.TestingSessionLocal()
    try:
        _, buyer, ev = _setup(db)
        agora = _agora()
        ing = Ingresso(
            evento_id=ev.id,
            usuario_id=buyer.id,
            participante_email=buyer.email,
            valor=50.0,
            status="pendente",
            data_compra=agora - timedelta(minutes=22),
            reservado_ate=agora + timedelta(minutes=13),
        )
        db.add(ing)
        db.commit()
        ingresso_id = ing.id

        def _sl():
            return test_api.TestingSessionLocal()

        with patch("app.services.lembrete_carrinho.SessionLocal", side_effect=_sl):
            with patch("app.services.lembrete_carrinho.enqueue_email_simples", return_value=False) as enq:
                n = enviar_lembretes_carrinho()
        # Enqueue tentado e falhou → nenhum sucesso contabilizado neste run
        # (return_value=False para todos) e claim liberado para retry.
        assert any(ev.slug in c[0][2] for c in enq.call_args_list)
        assert n == 0
        db2 = test_api.TestingSessionLocal()
        try:
            row = db2.get(Ingresso, ingresso_id)
            assert row is not None
            assert row.carrinho_lembrete_enviado_em is None
        finally:
            db2.close()
    finally:
        db.close()


def test_nao_envia_se_pago_antes_do_job():
    db = test_api.TestingSessionLocal()
    try:
        _, buyer, ev = _setup(db)
        agora = _agora()
        ing = Ingresso(
            evento_id=ev.id,
            usuario_id=buyer.id,
            participante_email=buyer.email,
            valor=50.0,
            status="pago",
            data_compra=agora - timedelta(minutes=25),
            reservado_ate=agora + timedelta(minutes=10),
        )
        db.add(ing)
        db.commit()

        def _sl():
            return test_api.TestingSessionLocal()

        with patch("app.services.lembrete_carrinho.SessionLocal", side_effect=_sl):
            with patch("app.services.lembrete_carrinho.enqueue_email_simples", return_value=True) as enq:
                enviar_lembretes_carrinho()
        assert not any(ev.slug in c[0][2] for c in enq.call_args_list)
        db3 = test_api.TestingSessionLocal()
        try:
            assert ing.id not in {c.id for c in candidatos_carrinho_abandonado(db3)}
        finally:
            db3.close()
    finally:
        db.close()


def test_nao_envia_se_cancelado_dentro_da_janela_20min():
    """A1: status cancelado não enfileira lembrete, mesmo com data_compra elegível."""
    db = test_api.TestingSessionLocal()
    try:
        _, buyer, ev = _setup(db)
        agora = _agora()
        ing = Ingresso(
            evento_id=ev.id,
            usuario_id=buyer.id,
            participante_email=buyer.email,
            valor=50.0,
            status="cancelado",
            data_compra=agora - timedelta(minutes=25),
            reservado_ate=agora + timedelta(minutes=10),
        )
        db.add(ing)
        db.commit()
        ingresso_id = ing.id

        def _sl():
            return test_api.TestingSessionLocal()

        with patch("app.services.lembrete_carrinho.SessionLocal", side_effect=_sl):
            with patch("app.services.lembrete_carrinho.enqueue_email_simples", return_value=True) as enq:
                n = enviar_lembretes_carrinho()
        assert n == 0
        assert enq.call_count == 0
        assert not any(ev.slug in str(c) for c in enq.call_args_list)
        db3 = test_api.TestingSessionLocal()
        try:
            assert ingresso_id not in {c.id for c in candidatos_carrinho_abandonado(db3)}
            row = db3.get(Ingresso, ingresso_id)
            assert row is not None
            assert row.carrinho_lembrete_enviado_em is None
        finally:
            db3.close()
    finally:
        db.close()
