"""Domínios de e-mail temporário recusados no cadastro."""

from __future__ import annotations

DOMINIOS_DESCARTAVEIS = frozenset(
    {
        "10minutemail.com",
        "burnermail.io",
        "discard.email",
        "dispostable.com",
        "emailondeck.com",
        "euploading.com",
        "fakeinbox.com",
        "getnada.com",
        "guerrillamail.com",
        "guerrillamail.net",
        "guerrillamail.org",
        "inboxkitten.com",
        "mail.gw",
        "mail.tm",
        "maildrop.cc",
        "mailinator.com",
        "mailnesia.com",
        "mintemail.com",
        "moakt.com",
        "mohmal.com",
        "mytemp.email",
        "sharklasers.com",
        "spamgourmet.com",
        "temp-mail.io",
        "temp-mail.org",
        "tempmail.com",
        "tempmailo.com",
        "tempr.email",
        "throwawaymail.com",
        "tmpmail.net",
        "tmpmail.org",
        "trashmail.com",
        "yopmail.com",
        "yopmail.net",
    }
)

MOTIVO_EMAIL_DESCARTAVEL = "Use um e-mail permanente. E-mails temporários não são aceitos no cadastro."


def email_descartavel(email: str) -> bool:
    dominio = email.rsplit("@", 1)[-1].strip().lower().rstrip(".")
    partes = dominio.split(".")
    return any(".".join(partes[i:]) in DOMINIOS_DESCARTAVEIS for i in range(len(partes) - 1))
