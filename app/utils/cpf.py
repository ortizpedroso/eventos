"""Validação de CPF (apenas dígitos, 11 posições)."""


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
