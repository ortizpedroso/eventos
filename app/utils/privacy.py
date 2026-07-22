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


def mask_pix_chave(value: str | None, tipo: str | None = None) -> str | None:
    if not value:
        return None
    chave = value.strip()
    tipo_norm = (tipo or "").strip().upper()
    if tipo_norm == "EMAIL" or "@" in chave:
        local, _, dominio = chave.partition("@")
        if not dominio:
            return "***"
        visivel = local[:2] if len(local) > 2 else local[:1]
        return f"{visivel}***@{dominio}"
    if tipo_norm == "CPF":
        return mask_cpf(chave)
    if tipo_norm == "CNPJ":
        digits = "".join(c for c in chave if c.isdigit())
        if len(digits) != 14:
            return "***"
        return f"**.***.***/****-{digits[-2:]}"
    if tipo_norm == "PHONE":
        return mask_telefone_br(chave)
    if len(chave) <= 8:
        return "***"
    return f"{chave[:4]}***{chave[-4:]}"
