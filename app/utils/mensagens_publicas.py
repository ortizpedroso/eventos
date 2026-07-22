"""Sanitiza mensagens expostas ao usuário — oculta nome do processador de pagamentos."""

from __future__ import annotations

import re

_SUBSTITUICOES: tuple[tuple[re.Pattern[str], str], ...] = (
    (
        re.compile(
            r"pessoa\s+f[ií]sica\s*\(\s*cpf\s*\).*(?:subconta|conta\s+de\s+recebimento).*(?:pessoa\s+jur[ií]dica|cnpj)",
            re.I | re.S,
        ),
        (
            "Não é possível criar sua conta de recebimento no momento. "
            "A configuração de pagamentos da plataforma está pendente. "
            "Entre em contato com o suporte EventosBR."
        ),
    ),
    (re.compile(r"conta\s+asaas", re.I), "conta de recebimentos"),
    (re.compile(r"painel\s+asaas", re.I), "sua conta de recebimentos"),
    (re.compile(r"\bsubconta\b", re.I), "conta de recebimento"),
    (re.compile(r"chave\s+api\s+asaas", re.I), "chave de acesso da conta de recebimentos"),
    (re.compile(r"api\s+asaas", re.I), "API da conta de recebimentos"),
    (re.compile(r"\basaas\b", re.I), "processador de pagamentos"),
    (re.compile(r"walletid", re.I), "ID da conta"),
)


def sanitizar_mensagem_pagamento(texto: str | None) -> str:
    """Remove referências ao fornecedor de pagamentos em mensagens ao usuário."""
    if not texto or not str(texto).strip():
        return "Não foi possível concluir a operação. Tente novamente ou contacte o suporte."
    msg = str(texto).strip()
    for pattern, repl in _SUBSTITUICOES:
        msg = pattern.sub(repl, msg)
    return msg
