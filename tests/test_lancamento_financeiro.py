"""Testes do lançamento financeiro completo."""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from unittest.mock import patch

import pytest

from app.models import Evento, Ingresso, Usuario
from app.services.assinatura_organizador import iniciar_cobranca_assinatura
from app.services.financeiro_conciliacao import conciliar_financeiro_organizador
from app.services.saque_asaas import validar_pix_cadastro_repasse
from app.utils.secret_storage import encrypt_at_rest
from tests import test_api


def _db():
    return test_api.TestingSessionLocal()


def test_validar_pix_cpf_divergente():
    u = Usuario(email="a@b.com", nome="A", tipo="organizador", asaas_repasse_cpf_cnpj="11144477735")
    with pytest.raises(ValueError, match="CPF"):
        validar_pix_cadastro_repasse(u, "22233344455", "CPF")


def test_conciliacao_retorna_ledger_e_asaas():
    db = _db()
    try:
        org = Usuario(
            email=f"c-{uuid.uuid4().hex[:6]}@ex.com",
            nome="Org",
            senha_hash="x",
            tipo="organizador",
            asaas_repasse_status="approved",
            asaas_subaccount_api_key=encrypt_at_rest("key"),
        )
        db.add(org)
        db.commit()
        with (
            patch.object(__import__("config.settings", fromlist=["settings"]).settings, "ASAAS_E2E_MOCK", True),
            patch.object(__import__("config.settings", fromlist=["settings"]).settings, "ENVIRONMENT", "test"),
        ):
            r = conciliar_financeiro_organizador(db, org)
        assert "ledger" in r
        assert r["ledger"]["saldo_esperado_asaas"] == 0.0
        assert r["asaas"].get("disponivel") is True
        assert "diferenca" in r
        assert "diferenca_disponivel" in r
    finally:
        db.close()


def test_conciliacao_sem_alerta_durante_carencia():
    """Ingresso em carência: ledger disponível = 0, mas saldo Asaas = líquido — sem alerta."""
    db = _db()
    try:
        org = Usuario(
            email=f"car-{uuid.uuid4().hex[:6]}@ex.com",
            nome="Org",
            senha_hash="x",
            tipo="organizador",
            asaas_repasse_status="approved",
            asaas_wallet_id=f"wallet_{uuid.uuid4().hex[:8]}",
            asaas_subaccount_api_key=encrypt_at_rest("key"),
        )
        db.add(org)
        db.commit()
        agora = datetime.now(timezone.utc).replace(tzinfo=None)
        ev = Evento(
            nome="Ev",
            slug=f"s-{uuid.uuid4().hex[:6]}",
            organizador_id=org.id,
            asaas_wallet_id=org.asaas_wallet_id,
            data_inicio=agora + timedelta(days=1),
            data_fim=agora + timedelta(days=1, hours=2),
            local="L",
        )
        db.add(ev)
        db.commit()
        ing = Ingresso(
            evento_id=ev.id,
            usuario_id=org.id,
            valor=100.0,
            status="pago",
            liquido_repassado=88.0,
            taxa_plataforma_aplicada=12.0,
            plano_tarifa_venda="padrao",
            asaas_payment_id=f"pay_{uuid.uuid4().hex[:6]}",
            pago_em=agora - timedelta(hours=1),
            data_compra=agora - timedelta(hours=1),
        )
        db.add(ing)
        db.commit()

        with patch(
            "app.services.financeiro_conciliacao.consultar_saldo_subconta",
            return_value={"disponivel": True, "balance": 88.0},
        ):
            r = conciliar_financeiro_organizador(db, org)

        assert r["ledger"]["liquido_acumulado"] == 88.0
        assert r["ledger"]["saldo_disponivel_saque"] == 0.0
        assert r["ledger"]["saldo_esperado_asaas"] == 88.0
        assert r["diferenca"] == 0.0
        assert r["alerta"] is None
        assert r["diferenca_disponivel"] == -88.0
    finally:
        db.close()


def test_conciliacao_alerta_quando_saldo_diverge():
    db = _db()
    try:
        org = Usuario(
            email=f"div-{uuid.uuid4().hex[:6]}@ex.com",
            nome="Org",
            senha_hash="x",
            tipo="organizador",
            asaas_repasse_status="approved",
            asaas_wallet_id=f"wallet_{uuid.uuid4().hex[:8]}",
            asaas_subaccount_api_key=encrypt_at_rest("key"),
        )
        db.add(org)
        db.commit()
        agora = datetime.now(timezone.utc).replace(tzinfo=None)
        ev = Evento(
            nome="Ev",
            slug=f"s-{uuid.uuid4().hex[:6]}",
            organizador_id=org.id,
            asaas_wallet_id=org.asaas_wallet_id,
            data_inicio=agora + timedelta(days=1),
            data_fim=agora + timedelta(days=1, hours=2),
            local="L",
        )
        db.add(ev)
        db.commit()
        ing = Ingresso(
            evento_id=ev.id,
            usuario_id=org.id,
            valor=50.0,
            status="pago",
            liquido_repassado=43.0,
            taxa_plataforma_aplicada=7.0,
            plano_tarifa_venda="padrao",
            asaas_payment_id=f"pay_{uuid.uuid4().hex[:6]}",
            pago_em=agora - timedelta(hours=72),
            data_compra=agora - timedelta(hours=72),
        )
        db.add(ing)
        db.commit()

        with patch(
            "app.services.financeiro_conciliacao.consultar_saldo_subconta",
            return_value={"disponivel": True, "balance": 30.0},
        ):
            r = conciliar_financeiro_organizador(db, org)

        assert r["diferenca"] == 13.0
        assert r["alerta"] is not None
    finally:
        db.close()


def test_estorno_no_extrato():
    from app.services.financeiro_organizador import listar_extrato

    db = _db()
    try:
        org = Usuario(email=f"e-{uuid.uuid4().hex[:6]}@ex.com", nome="O", senha_hash="x", tipo="organizador")
        db.add(org)
        db.commit()
        agora = datetime.now(timezone.utc).replace(tzinfo=None)
        ev = Evento(
            nome="Ev",
            slug=f"s-{uuid.uuid4().hex[:6]}",
            organizador_id=org.id,
            data_inicio=agora,
            data_fim=agora + timedelta(hours=2),
            local="L",
        )
        db.add(ev)
        db.commit()
        ing = Ingresso(
            evento_id=ev.id,
            usuario_id=org.id,
            valor=40.0,
            status="cancelado",
            liquido_repassado=35.0,
            asaas_payment_id=f"pay_{uuid.uuid4().hex[:6]}",
            estornado_em=agora,
        )
        db.add(ing)
        db.commit()
        ex = listar_extrato(db, org, limite=20)
        assert any(m["tipo"] == "estorno" for m in ex["movimentos"])
    finally:
        db.close()
