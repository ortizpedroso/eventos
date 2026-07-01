"""Validação de CPF e CNPJ com dígito verificador."""


def normalizar_cpf(valor: str | None) -> str:
    if not valor:
        return ""
    return "".join(c for c in str(valor) if c.isdigit())[:11]


def cpf_valido(digits: str) -> bool:
    if len(digits) != 11 or not digits.isdigit():
        return False
    if digits == digits[0] * 11:
        return False

    def dv(base: str, pesos: list[int]) -> int:
        s = sum(int(b) * p for b, p in zip(base, pesos, strict=True))
        r = s % 11
        return 0 if r < 2 else 11 - r

    d1 = dv(digits[:9], list(range(10, 1, -1)))
    if d1 != int(digits[9]):
        return False
    d2 = dv(digits[:10], list(range(11, 1, -1)))
    return d2 == int(digits[10])


def cnpj_valido(digits: str) -> bool:
    """Valida CNPJ com dígito verificador (algoritmo módulo 11)."""
    if len(digits) != 14 or not digits.isdigit():
        return False
    if digits == digits[0] * 14:
        return False

    def dv(base: str, pesos: list[int]) -> int:
        s = sum(int(b) * p for b, p in zip(base, pesos, strict=True))
        r = s % 11
        return 0 if r < 2 else 11 - r

    pesos1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
    pesos2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
    d1 = dv(digits[:12], pesos1)
    if d1 != int(digits[12]):
        return False
    d2 = dv(digits[:13], pesos2)
    return d2 == int(digits[13])


def cpf_ou_cnpj_valido(digits: str) -> bool:
    """Valida CPF (11 dígitos) ou CNPJ (14 dígitos) com dígito verificador."""
    if len(digits) == 11:
        return cpf_valido(digits)
    if len(digits) == 14:
        return cnpj_valido(digits)
    return False
