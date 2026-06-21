"""Validação básica de cartão antes de enviar ao gateway."""

from __future__ import annotations

import re
from datetime import datetime, timezone


def _luhn_ok(numero: str) -> bool:
    digits = [int(c) for c in numero if c.isdigit()]
    if len(digits) < 13 or len(digits) > 19:
        return False
    checksum = 0
    parity = len(digits) % 2
    for i, d in enumerate(digits):
        if i % 2 == parity:
            d *= 2
            if d > 9:
                d -= 9
        checksum += d
    return checksum % 10 == 0


def validar_dados_cartao(
    credit_card: dict | None,
    credit_card_holder_info: dict | None,
) -> None:
    if not credit_card or not credit_card_holder_info:
        raise ValueError("Informe os dados do cartão para pagar com cartão.")

    nome = (credit_card.get("holderName") or credit_card_holder_info.get("name") or "").strip()
    numero = re.sub(r"\D", "", str(credit_card.get("number") or ""))
    mes = re.sub(r"\D", "", str(credit_card.get("expiryMonth") or ""))
    ano_raw = re.sub(r"\D", "", str(credit_card.get("expiryYear") or ""))
    cvv = re.sub(r"\D", "", str(credit_card.get("ccv") or ""))
    cpf = re.sub(r"\D", "", str(credit_card_holder_info.get("cpfCnpj") or ""))
    cep = re.sub(r"\D", "", str(credit_card_holder_info.get("postalCode") or ""))

    if len(nome) < 3:
        raise ValueError("Informe o nome impresso no cartão.")
    if not _luhn_ok(numero):
        raise ValueError("Número do cartão inválido.")
    if len(mes) != 2 or not (1 <= int(mes) <= 12):
        raise ValueError("Validade do cartão inválida (mês).")
    if len(ano_raw) not in (2, 4):
        raise ValueError("Validade do cartão inválida (ano).")
    ano = int(ano_raw) if len(ano_raw) == 4 else 2000 + int(ano_raw)
    agora = datetime.now(timezone.utc).replace(tzinfo=None)
    if ano < agora.year or (ano == agora.year and int(mes) < agora.month):
        raise ValueError("Cartão expirado.")
    if len(cvv) < 3 or len(cvv) > 4:
        raise ValueError("CVV inválido.")
    if len(cpf) not in (11, 14):
        raise ValueError("CPF ou CNPJ do titular inválido.")
    if len(cep) != 8:
        raise ValueError("CEP inválido.")
