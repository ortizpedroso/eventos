"""Conciliação entre ledger interno e saldo Asaas da subconta."""

from __future__ import annotations

from typing import Any

from sqlalchemy.orm import Session

from app.models import Usuario
from app.services.financeiro_organizador import calcular_saldo_organizador
from app.services.saque_asaas import consultar_saldo_subconta


def conciliar_financeiro_organizador(db: Session, usuario: Usuario) -> dict[str, Any]:
    ledger = calcular_saldo_organizador(db, usuario)
    asaas = consultar_saldo_subconta(usuario)

    ledger_disp = float(ledger.get("saldo_disponivel_saque") or 0)
    asaas_disp = float(asaas.get("balance") or 0) if asaas.get("disponivel") else None
    diferenca = round(ledger_disp - asaas_disp, 2) if asaas_disp is not None else None

    alerta = None
    if diferenca is not None and abs(diferenca) > 0.05:
        alerta = (
            "Há diferença entre o saldo calculado pela plataforma e o saldo na conta de repasses. "
            "Isso pode ocorrer por antecipações, taxas do gateway, estornos recentes ou saques em processamento."
        )

    return {
        "ledger": {
            "liquido_acumulado": ledger.get("liquido_acumulado"),
            "saldo_em_carencia": ledger.get("saldo_em_carencia"),
            "saldo_disponivel_saque": ledger_disp,
            "saques_reservados": ledger.get("saques_reservados"),
        },
        "asaas": asaas,
        "diferenca_disponivel": diferenca,
        "alerta": alerta,
        "nota": (
            "O ledger reflete ingressos confirmados na plataforma (com carência de saque). "
            "O saldo Asaas é o valor custodiado na subconta no momento da consulta."
        ),
    }
