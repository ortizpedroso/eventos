"""Conciliação entre ledger interno e saldo Asaas da subconta."""

from __future__ import annotations

from typing import Any

from sqlalchemy.orm import Session

from app.models import Usuario
from app.services.financeiro_organizador import calcular_saldo_organizador
from app.services.saque_asaas import consultar_saldo_subconta
from config.settings import settings


def conciliar_financeiro_organizador(db: Session, usuario: Usuario) -> dict[str, Any]:
    ledger = calcular_saldo_organizador(db, usuario)
    asaas = consultar_saldo_subconta(usuario)

    liquido = float(ledger.get("liquido_acumulado") or 0)
    saques_pagos = float(ledger.get("saques_pagos_total") or 0)
    ledger_esperado_asaas = round(liquido - saques_pagos, 2)

    disponivel = float(ledger.get("saldo_disponivel_saque") or 0)
    asaas_balance = float(asaas.get("balance") or 0) if asaas.get("disponivel") else None

    diferenca = round(ledger_esperado_asaas - asaas_balance, 2) if asaas_balance is not None else None
    diferenca_disponivel = round(disponivel - asaas_balance, 2) if asaas_balance is not None else None

    alerta = None
    if diferenca is not None and abs(diferenca) > 0.05:
        alerta = (
            "Há diferença entre o ledger (líquido acumulado − saques pagos) e o saldo na conta de repasses. "
            "Isso pode ocorrer por antecipações, taxas do gateway, estornos recentes ou saques em processamento."
        )

    nota = (
        "Com conta de recebimento vinculada (modo linked), os repasses caem via split na sua conta. "
        "A conciliação de saldo na subconta não se aplica — acompanhe vendas pelo extrato da plataforma."
        if not asaas.get("disponivel")
        and settings.permite_vinculo_wallet_organizador()
        and (usuario.asaas_repasse_status or "").strip().lower() == "linked"
        else (
            "A conciliação principal compara o ledger esperado na subconta "
            "(líquido acumulado − saques pagos) com o saldo na conta de recebimento. "
            "Valores em carência de saque permanecem no saldo da conta e não geram divergência. "
            "A diferença disponível (saldo liberado para saque vs conta de recebimento) é apenas informativa."
        )
    )

    return {
        "ledger": {
            "liquido_acumulado": liquido,
            "saques_pagos_total": saques_pagos,
            "saldo_esperado_asaas": ledger_esperado_asaas,
            "saldo_em_carencia": ledger.get("saldo_em_carencia"),
            "saldo_disponivel_saque": disponivel,
            "saques_reservados": ledger.get("saques_reservados"),
        },
        "asaas": asaas,
        "diferenca": diferenca,
        "diferenca_disponivel": diferenca_disponivel,
        "alerta": alerta,
        "nota": nota,
    }
