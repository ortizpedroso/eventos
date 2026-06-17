"""Cadastro de cliente/conta no provedor de pagamento (Asaas)."""

from __future__ import annotations

from app.services.usuario_asaas import criar_asaas_para_novo_usuario


def criar_pagamento_para_novo_usuario(
    *,
    email: str,
    nome: str,
    tipo: str,
    cpf_cnpj: str | None = None,
    telefone: str | None = None,
) -> dict:
    """Retorna dict com ids do Asaas."""
    cid, wallet, acc = criar_asaas_para_novo_usuario(
        email=email,
        nome=nome,
        tipo=tipo,
        cpf_cnpj=cpf_cnpj,
        telefone=telefone,
    )
    return {
        "payment_provider": "asaas",
        "asaas_customer_id": cid,
        "asaas_wallet_id": wallet,
        "asaas_account_id": acc,
    }
