"""Mascaramento de dados sensíveis em respostas JSON (listagens do próprio utilizador)."""


def mask_cpf(value: str | None) -> str | None:
    if not value:
        return None
    digits = "".join(c for c in value if c.isdigit())
    if len(digits) != 11:
        return "***"
    return f"***.***.***-{digits[-2:]}"


def mask_telefone_br(value: str | None) -> str | None:
    if not value:
        return None
    digits = "".join(c for c in value if c.isdigit())
    if len(digits) < 4:
        return "(***) ***-****"
    return f"(**) ****-{digits[-4:]}"
