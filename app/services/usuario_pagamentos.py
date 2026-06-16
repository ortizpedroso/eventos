"""Cadastro de cliente/conta no provedor de pagamento ativo."""

from __future__ import annotations

from app.services.usuario_asaas import criar_asaas_para_novo_usuario
from app.services.usuario_stripe import criar_stripe_para_novo_usuario
from config.settings import settings


def criar_pagamento_para_novo_usuario(
    *,
    email: str,
    nome: str,
    tipo: str,
    cpf_cnpj: str | None = None,
    telefone: str | None = None,
) -> dict:
    """Retorna dict com ids do provedor ativo."""
    if settings.use_asaas:
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
            "stripe_customer_id": None,
            "stripe_account_id": None,
        }
    sc, sa = criar_stripe_para_novo_usuario(email=email, nome=nome, tipo=tipo)
    return {
        "payment_provider": "stripe",
        "asaas_customer_id": None,
        "asaas_wallet_id": None,
        "asaas_account_id": None,
        "stripe_customer_id": sc,
        "stripe_account_id": sa,
    }
