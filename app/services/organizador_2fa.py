"""Regras de negócio do 2FA (TOTP) para organizadores.

Fluxo:
1. iniciar_totp()   -> gera segredo (ainda inativo), devolve QR + secret p/ digitar manualmente
2. confirmar_totp() -> valida 1º código digitado, ativa e gera códigos de recuperação (mostrados 1x)
3. login exige codigo/recovery via verificar_totp_ou_recovery() quando totp_ativado=True
4. desativar_totp() -> exige código válido (TOTP ou recovery) antes de desligar
"""

from __future__ import annotations

import base64
import json
from datetime import datetime, timezone
from io import BytesIO

import qrcode
from sqlalchemy.orm import Session

from app.models.usuario import Usuario
from app.services import totp as totp_service
from app.services.auth import pwd_context
from app.utils.secret_storage import decrypt_at_rest, encrypt_at_rest


class TotpError(Exception):
    pass


def iniciar_totp(db: Session, usuario: Usuario) -> dict:
    if usuario.tipo != "organizador":
        raise TotpError("2FA disponível apenas para contas de organizador.")
    if usuario.totp_ativado:
        raise TotpError("2FA já está ativado nesta conta.")

    secret = totp_service.gerar_secret()
    usuario.totp_secret = encrypt_at_rest(secret)
    db.add(usuario)
    db.commit()

    otpauth_uri = totp_service.build_otpauth_uri(secret, usuario.email)
    img = qrcode.make(otpauth_uri)
    buf = BytesIO()
    img.save(buf, format="PNG")
    qr_base64 = base64.b64encode(buf.getvalue()).decode("ascii")

    return {"secret": secret, "otpauth_uri": otpauth_uri, "qr_base64": qr_base64}


def confirmar_totp(db: Session, usuario: Usuario, codigo: str) -> list[str]:
    if not usuario.totp_secret:
        raise TotpError("Inicie o cadastro do 2FA antes de confirmar.")
    if usuario.totp_ativado:
        raise TotpError("2FA já está ativado nesta conta.")

    secret = decrypt_at_rest(usuario.totp_secret)
    if not totp_service.verificar_codigo(secret, codigo):
        raise TotpError("Código inválido. Verifique o horário do seu celular e tente novamente.")

    recovery_plain = totp_service.gerar_recovery_codes()
    recovery_hashed = [pwd_context.hash(c) for c in recovery_plain]

    usuario.totp_ativado = True
    usuario.totp_ativado_em = datetime.now(timezone.utc).replace(tzinfo=None)
    usuario.totp_recovery_codes = json.dumps(recovery_hashed)
    db.add(usuario)
    db.commit()

    return recovery_plain


def _consumir_recovery_code(db: Session, usuario: Usuario, codigo: str) -> bool:
    if not usuario.totp_recovery_codes:
        return False
    try:
        hashes: list[str] = json.loads(usuario.totp_recovery_codes)
    except (TypeError, ValueError):
        return False

    for h in hashes:
        if pwd_context.verify(codigo, h):
            hashes.remove(h)
            usuario.totp_recovery_codes = json.dumps(hashes)
            db.add(usuario)
            db.commit()
            return True
    return False


def verificar_totp_ou_recovery(db: Session, usuario: Usuario, codigo: str) -> bool:
    """True se `codigo` for um TOTP válido OU um código de recuperação (consumido no acerto)."""
    codigo = (codigo or "").strip()
    if not codigo:
        return False

    if usuario.totp_secret:
        secret = decrypt_at_rest(usuario.totp_secret)
        if totp_service.verificar_codigo(secret, codigo):
            return True

    if "-" in codigo:
        return _consumir_recovery_code(db, usuario, codigo.upper())
    return False


def desativar_totp(db: Session, usuario: Usuario, codigo: str) -> None:
    if not usuario.totp_ativado:
        raise TotpError("2FA não está ativado nesta conta.")
    if not verificar_totp_ou_recovery(db, usuario, codigo):
        raise TotpError("Código inválido.")

    usuario.totp_ativado = False
    usuario.totp_ativado_em = None
    usuario.totp_secret = None
    usuario.totp_recovery_codes = None
    db.add(usuario)
    db.commit()
