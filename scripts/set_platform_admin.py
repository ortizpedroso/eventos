#!/usr/bin/env python3
"""Define (ou remove) o papel de administrador da plataforma para uma conta existente.

Uso (dentro do container da API, ou localmente com o mesmo DATABASE_URL):
  python3 scripts/set_platform_admin.py dono@eventosbr.app.br
  python3 scripts/set_platform_admin.py dono@eventosbr.app.br --remove

Não cria conta nova — a pessoa precisa já estar cadastrada. Depois de rodar, ela ainda
precisa ativar o 2FA (Perfil → seção de segurança) antes de conseguir acessar o painel
administrativo via login normal — este script não ativa 2FA por ela (exige escanear
QR Code, só a própria pessoa pode fazer isso).
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from app.models import Usuario, get_db  # noqa: E402


def main() -> int:
    parser = argparse.ArgumentParser(description="Definir/remover admin da plataforma")
    parser.add_argument("email", help="E-mail da conta já cadastrada")
    parser.add_argument("--remove", action="store_true", help="Remove o papel de admin (em vez de conceder)")
    args = parser.parse_args()

    email = args.email.strip().lower()
    db = next(get_db())
    try:
        usuario = db.query(Usuario).filter(Usuario.email == email).first()
        if not usuario:
            print(f"ERRO: nenhuma conta encontrada com o e-mail {email!r}.", file=sys.stderr)
            print("Cadastre a conta normalmente no site primeiro, depois rode este script.", file=sys.stderr)
            return 1

        novo_valor = not args.remove
        if usuario.is_platform_admin == novo_valor:
            print(f"Nenhuma mudança: {email} já está com is_platform_admin={novo_valor}.")
            return 0

        usuario.is_platform_admin = novo_valor
        db.commit()

        if novo_valor:
            print(f"OK: {email} agora é administrador da plataforma.")
            if not usuario.totp_ativado:
                print(
                    "AVISO: essa conta ainda não tem 2FA ativado. O acesso ao painel "
                    "admin via login normal fica bloqueado até a própria pessoa ativar "
                    "o 2FA em Perfil → Segurança (ou Whitelabel, se for organizador)."
                )
        else:
            print(f"OK: {email} não é mais administrador da plataforma.")
        return 0
    finally:
        db.close()


if __name__ == "__main__":
    raise SystemExit(main())
