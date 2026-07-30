"""Ingresso grátis / cortesia não gera taxa EventosBR."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

from app.models import Evento, Ingresso, Usuario
from app.services.financeiro_organizador import (
    calcular_saldo_organizador,
    corrigir_taxa_ingressos_gratis,
    listar_extrato,
)
from app.services.tarifas_plataforma import (
    TARIFA_ASSINATURA,
    TARIFA_PADRAO,
    detalhar_taxa_ingresso,
    ledger_ingresso_venda,
    taxa_ingresso,
)
from tests import test_api


def test_taxa_ingresso_zero_para_gratis():
    assert taxa_ingresso(0.0, TARIFA_PADRAO) == 0.0
    assert taxa_ingresso(0.0, TARIFA_ASSINATURA) == 0.0
    assert detalhar_taxa_ingresso(0.0, TARIFA_PADRAO)["taxa_total"] == 0.0
    assert detalhar_taxa_ingresso(0.0, TARIFA_PADRAO)["taxa_fixa"] == 0.0
    assert detalhar_taxa_ingresso(0.0, TARIFA_PADRAO)["liquido_organizador"] == 0.0
    ledger = ledger_ingresso_venda(0.0, tarifa=TARIFA_PADRAO)
    assert ledger["taxa_plataforma_aplicada"] == 0.0
    assert ledger["liquido_repassado"] == 0.0


def test_detalhar_pago_ainda_cobra_fixo():
    det = detalhar_taxa_ingresso(100.0, TARIFA_PADRAO)
    assert det["taxa_fixa"] == 2.0
    assert det["taxa_total"] == 12.0
    assert taxa_ingresso(100.0, TARIFA_PADRAO) == det["taxa_total"]


def test_corrigir_taxa_ingressos_gratis_e_api_publica():
    """Helper exportado em __all__ — rotas/relatórios não devem importar nome privado."""
    import app.services.financeiro_organizador as fin

    assert "corrigir_taxa_ingressos_gratis" in fin.__all__
    assert callable(corrigir_taxa_ingressos_gratis)


def test_financeiro_corrige_taxa_fantasma_em_ingresso_gratis():
    db = test_api.TestingSessionLocal()
    org = Usuario(
        email="org.gratis.taxa@test.com",
        nome="Org Gratis",
        senha_hash="x",
        tipo="organizador",
    )
    db.add(org)
    db.commit()
    db.refresh(org)

    agora = datetime.now(timezone.utc).replace(tzinfo=None)
    ev = Evento(
        nome="Encontro Gratis",
        descricao="d",
        data_inicio=agora + timedelta(days=5),
        data_fim=agora + timedelta(days=5, hours=2),
        local="Arena",
        cidade="SP",
        categoria="Encontros",
        preco_ingresso=0.0,
        organizador_id=org.id,
        slug="encontro-gratis-taxa-test",
        publicado=True,
    )
    db.add(ev)
    db.commit()
    db.refresh(ev)

    # Simula bug antigo: ingresso R$0 com taxa fixa gravada
    for _ in range(2):
        db.add(
            Ingresso(
                evento_id=ev.id,
                usuario_id=org.id,
                participante_nome="Convidado",
                participante_email="c@test.com",
                valor=0.0,
                status="pago",
                pago_em=agora,
                liquido_repassado=0.0,
                taxa_plataforma_aplicada=2.0,
                plano_tarifa_venda="padrao",
            )
        )
    db.commit()
    db.refresh(org)

    # Extrato deve corrigir antes de montar movimentos (não só no saldo embutido).
    extrato = listar_extrato(db, org)
    vendas = [m for m in extrato["movimentos"] if m.get("tipo") == "venda"]
    assert len(vendas) == 2
    assert all(m["taxa_plataforma"] == 0.0 for m in vendas)
    assert all(m["valor_ingresso"] == 0.0 for m in vendas)
    assert extrato["saldo"]["receita_bruta"] == 0.0
    assert extrato["saldo"]["taxa_plataforma_total"] == 0.0
    assert extrato["saldo"]["ingressos_pagos"] == 2

    saldo = calcular_saldo_organizador(db, org)
    assert saldo["taxa_plataforma_total"] == 0.0

    # Persistiu a correção
    db.expire_all()
    rows = db.query(Ingresso).filter(Ingresso.evento_id == ev.id).all()
    assert all(float(r.taxa_plataforma_aplicada or 0) == 0.0 for r in rows)
    db.close()
