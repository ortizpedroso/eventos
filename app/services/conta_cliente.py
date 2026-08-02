"""Conta cliente — criação/reaproveitamento por e-mail (PDV, compra rápida, correção)."""

from __future__ import annotations

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models import Usuario


def obter_ou_criar_conta_cliente(db: Session, *, email: str, nome: str) -> tuple[Usuario, bool]:
    """Reaproveita ou cria conta cliente para um ingresso.

    Conta desativada → ValueError. E-mail novo → cria sem senha. Sem Asaas.
    """
    existente = db.query(Usuario).filter(func.lower(Usuario.email) == email).first()
    if existente:
        if not existente.ativo:
            raise ValueError(
                "Este e-mail pertence a uma conta desativada. Use outro e-mail para o ingresso."
            )
        return existente, False

    novo_usuario = Usuario(
        email=email,
        nome=nome,
        senha_hash=None,
        tipo="cliente",
        auth_provider="email",
        email_verificado=False,
    )
    db.add(novo_usuario)
    db.commit()
    db.refresh(novo_usuario)
    return novo_usuario, True
