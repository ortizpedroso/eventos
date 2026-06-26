"""Testes de saque white-label, carência 48h e relatórios de vendas."""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from unittest.mock import patch

import pytest

from app.models import Evento, FinanceiroSaque, Ingresso, Usuario
from app.services.financeiro_organizador import (
    calcular_saldo_organizador,
    listar_vendas_agrupadas,
    solicitar_saque,
)
from app.services.saque_asaas import aplicar_webhook_transferencia, inferir_pix_tipo
from app.utils.secret_storage import encrypt_at_rest
from tests import test_api


def _db():
    return test_api.TestingSessionLocal()


def _org_aprovado(db) -> Usuario:
    org = Usuario(
        email=f"org-saque-{uuid.uuid4().hex[:8]}@ex.com",
        nome="Org Saque",
        senha_hash="x",
        tipo="organizador",
        asaas_wallet_id=f"wallet_{uuid.uuid4().hex[:8]}",
        asaas_account_id=f"acc_{uuid.uuid4().hex[:8]}",
        asaas_repasse_status="approved",
        asaas_subaccount_api_key=encrypt_at_rest("key_test_saque"),
    )
    db.add(org)
    db.commit()
    db.refresh(org)
    return org


def _evento(db, org_id: str, nome: str = "Show") -> Evento:
    agora = datetime.now(timezone.utc).replace(tzinfo=None)
    ev = Evento(
        nome=nome,
        slug=f"ev-{uuid.uuid4().hex[:8]}",
        organizador_id=org_id,
        publicado=False,
        asaas_wallet_id="wallet_x",
        data_inicio=agora + timedelta(days=7),
        data_fim=agora + timedelta(days=7, hours=4),
        local="Local",
    )
    db.add(ev)
    db.commit()
    db.refresh(ev)
    return ev


def _ingresso_pago(
    db,
    ev: Evento,
    org: Usuario,
    *,
    valor: float = 100.0,
    liquido: float = 88.0,
    pago_em: datetime | None = None,
) -> Ingresso:
    agora = datetime.now(timezone.utc).replace(tzinfo=None)
    ref = pago_em or (agora - timedelta(hours=72))
    ing = Ingresso(
        evento_id=ev.id,
        usuario_id=org.id,
        valor=valor,
        status="pago",
        liquido_repassado=liquido,
        taxa_plataforma_aplicada=round(valor - liquido, 2),
        plano_tarifa_venda="padrao",
        asaas_payment_id=f"pay_{uuid.uuid4().hex[:8]}",
        pago_em=ref,
        data_compra=ref,
    )
    db.add(ing)
    db.commit()
    return ing


def test_inferir_pix_tipo():
    assert inferir_pix_tipo("teste@exemplo.com") == "EMAIL"
    assert inferir_pix_tipo("11144477735") == "CPF"
    assert inferir_pix_tipo("66625514000140") == "CNPJ"


def test_carencia_48h_bloqueia_saque():
    db = _db()
    try:
        org = _org_aprovado(db)
        ev = _evento(db, org.id)
        agora = datetime.now(timezone.utc).replace(tzinfo=None)
        _ingresso_pago(db, ev, org, liquido=50.0, pago_em=agora - timedelta(hours=1))

        saldo = calcular_saldo_organizador(db, org)
        assert saldo["saldo_em_carencia"] == 50.0
        assert saldo["saldo_disponivel_saque"] == 0.0
        assert saldo["carencia_horas"] == 48
    finally:
        db.close()


def test_saldo_disponivel_apos_carencia():
    db = _db()
    try:
        org = _org_aprovado(db)
        ev = _evento(db, org.id)
        _ingresso_pago(db, ev, org, liquido=80.0)

        saldo = calcular_saldo_organizador(db, org)
        assert saldo["saldo_disponivel_saque"] == 80.0
        assert saldo["saque_habilitado"] is True
    finally:
        db.close()


def test_solicitar_saque_com_mock_asaas():
    db = _db()
    try:
        org = _org_aprovado(db)
        ev = _evento(db, org.id)
        _ingresso_pago(db, ev, org, liquido=100.0)

        from config.settings import settings

        with (
            patch.object(settings, "ASAAS_E2E_MOCK", True),
            patch.object(settings, "ENVIRONMENT", "test"),
        ):
            saque = solicitar_saque(
                db,
                org,
                valor=40.0,
                pix_chave="teste@exemplo.com",
                pix_tipo="EMAIL",
            )
        assert saque.status in ("processando", "pago")
        assert saque.asaas_transfer_id
        assert saque.previsao_liquidacao_em is not None

        saldo = calcular_saldo_organizador(db, org)
        assert saldo["saldo_disponivel_saque"] == 60.0
        assert saldo["saques_reservados"] >= 40.0
    finally:
        db.close()


def test_solicitar_saque_acima_do_disponivel():
    db = _db()
    try:
        org = _org_aprovado(db)
        ev = _evento(db, org.id)
        _ingresso_pago(db, ev, org, liquido=30.0)

        with pytest.raises(ValueError, match="Saldo disponível"):
            solicitar_saque(db, org, valor=50.0, pix_chave="teste@exemplo.com")
    finally:
        db.close()


def test_webhook_transfer_done_marca_pago():
    db = _db()
    try:
        org = _org_aprovado(db)
        agora = datetime.now(timezone.utc).replace(tzinfo=None)
        saque = FinanceiroSaque(
            organizador_id=org.id,
            valor=25.0,
            pix_chave="a@b.com",
            pix_tipo="EMAIL",
            status="processando",
            asaas_transfer_id="tra_test_1",
            criado_em=agora,
            atualizado_em=agora,
        )
        db.add(saque)
        db.commit()

        aplicar_webhook_transferencia(
            db,
            {"id": "tra_test_1", "status": "DONE", "externalReference": saque.id},
            event_type="TRANSFER_DONE",
        )
        db.commit()
        db.refresh(saque)
        assert saque.status == "pago"
        assert saque.processado_em is not None
    finally:
        db.close()


def test_webhook_transfer_done_sem_status_marca_pago():
    """§7: event_type TRANSFER_DONE sem transfer.status deve marcar saque pago."""
    db = _db()
    try:
        org = _org_aprovado(db)
        agora = datetime.now(timezone.utc).replace(tzinfo=None)
        tid = f"tra_{uuid.uuid4().hex[:10]}"
        saque = FinanceiroSaque(
            organizador_id=org.id,
            valor=30.0,
            pix_chave="a@b.com",
            pix_tipo="EMAIL",
            status="processando",
            asaas_transfer_id=tid,
            criado_em=agora,
            atualizado_em=agora,
        )
        db.add(saque)
        db.commit()

        aplicar_webhook_transferencia(
            db,
            {"id": tid, "externalReference": saque.id},
            event_type="TRANSFER_DONE",
        )
        db.commit()
        db.refresh(saque)
        assert saque.status == "pago"
    finally:
        db.close()


def test_webhook_transfer_failed_sem_status_marca_rejeitado():
    db = _db()
    try:
        org = _org_aprovado(db)
        agora = datetime.now(timezone.utc).replace(tzinfo=None)
        tid = f"tra_{uuid.uuid4().hex[:10]}"
        saque = FinanceiroSaque(
            organizador_id=org.id,
            valor=20.0,
            pix_chave="a@b.com",
            pix_tipo="EMAIL",
            status="processando",
            asaas_transfer_id=tid,
            criado_em=agora,
            atualizado_em=agora,
        )
        db.add(saque)
        db.commit()

        aplicar_webhook_transferencia(
            db,
            {"id": tid, "failReason": "Erro bancário"},
            event_type="TRANSFER_FAILED",
        )
        db.commit()
        db.refresh(saque)
        assert saque.status == "rejeitado"
    finally:
        db.close()


def test_vendas_agrupadas_por_evento():
    db = _db()
    try:
        org = _org_aprovado(db)
        ev1 = _evento(db, org.id, "Festival")
        ev2 = _evento(db, org.id, "Workshop")
        _ingresso_pago(db, ev1, org, valor=50, liquido=43)
        _ingresso_pago(db, ev1, org, valor=50, liquido=43)
        _ingresso_pago(db, ev2, org, valor=30, liquido=24)

        rel = listar_vendas_agrupadas(db, org, agrupamento="evento")
        assert rel["totais"]["ingressos"] == 3
        assert rel["totais"]["liquido"] == 110.0
        assert len(rel["grupos"]) == 2
    finally:
        db.close()
