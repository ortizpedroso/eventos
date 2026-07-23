"""Conciliação entre ledger interno e saldo da conta de recebimento."""

from __future__ import annotations

from typing import Any

from sqlalchemy.orm import Session

from app.models import Usuario
from app.services.financeiro_organizador import calcular_saldo_organizador
from app.services.saque_asaas import consultar_saldo_subconta


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
            "Isso pode ocorrer por antecipações, taxas de processamento, estornos recentes ou saques em processamento."
        )

    nota = (
        "A conciliação compara o ledger esperado (líquido acumulado − saques pagos) "
        "com o saldo na sua conta de recebimento. "
        "Valores em carência de saque permanecem no saldo e não geram divergência. "
        "A diferença disponível é apenas informativa."
        if asaas.get("disponivel")
        else "Saldo da conta de recebimento indisponível no momento — acompanhe vendas pelo extrato da plataforma."
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
