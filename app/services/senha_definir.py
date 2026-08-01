"""Link de 'definir senha' pra contas sem senha (PDV, compra rápida) — mesmo
padrão de token/expiração usado em /auth/solicitar-recuperacao-senha."""

from __future__ import annotations

import secrets
from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from app.models import Usuario
from app.services.password_reset_email import enviar_email_recuperacao_senha
from config.settings import settings

SENHA_RESET_VALIDADE_HORAS = 1


def gerar_link_definir_senha(db: Session, usuario: Usuario) -> str:
    """Gera (renovando) o token de definição de senha do usuário e devolve o link."""
    token = secrets.token_urlsafe(32)
    agora = datetime.now(timezone.utc).replace(tzinfo=None)
    usuario.senha_reset_token = token
    usuario.senha_reset_expires = agora + timedelta(hours=SENHA_RESET_VALIDADE_HORAS)
    db.commit()
    base = (settings.FRONTEND_PUBLIC_URL or "http://localhost:3000").rstrip("/")
    return f"{base}/auth?reset={token}"


def enviar_email_primeiro_acesso(db: Session, usuario: Usuario) -> bool:
    """Dispara o e-mail de 'defina sua senha' pra conta criada sem senha (ex.: PDV)."""
    link = gerar_link_definir_senha(db, usuario)
    return enviar_email_recuperacao_senha(
        destino=usuario.email,
        nome=usuario.nome,
        link=link,
        primeiro_acesso=True,
    )
