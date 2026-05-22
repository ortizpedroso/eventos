"""Criação de Customer / Connect Stripe no registro de usuário."""

from __future__ import annotations

import logging

import stripe

from app.utils.public_errors import STRIPE_CLIENTE
from config.settings import settings

logger = logging.getLogger(__name__)


def _stripe_connect_platform_terms_missing(err: Exception) -> bool:
    text = str(err).lower()
    if "managing losses" in text or "loss liability" in text:
        return True
    if "responsibilities" in text and "losses" in text:
        return True
    return False


def criar_stripe_para_novo_usuario(
    *,
    email: str,
    nome: str,
    tipo: str,
) -> tuple[str | None, str | None]:
    """Retorna (stripe_customer_id, stripe_account_id)."""
    if settings.STRIPE_DISABLED:
        logger.warning("STRIPE_DISABLED: usuário %s sem Customer/Connect", email)
        return None, None

    stripe.api_key = settings.STRIPE_SECRET_KEY
    customer = stripe.Customer.create(email=email, name=nome)
    stripe_customer_id = customer.id
    stripe_account_id: str | None = None

    if tipo == "organizador" and not settings.STRIPE_SKIP_CONNECT_ON_REGISTER:
        try:
            account = stripe.Account.create(
                type="express",
                country="BR",
                email=email,
            )
            stripe_account_id = account.id
        except stripe.error.StripeError as conn_err:
            if _stripe_connect_platform_terms_missing(conn_err):
                logger.warning(
                    "Connect não criado no cadastro (termos pendentes): %s",
                    email,
                )
                stripe_account_id = None
            else:
                logger.exception("Erro Stripe Connect")
                raise
    return stripe_customer_id, stripe_account_id
