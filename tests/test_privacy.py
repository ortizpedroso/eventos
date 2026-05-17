from app.utils.privacy import mask_cpf, mask_telefone_br


def test_mask_cpf_valido():
    assert mask_cpf("123.456.789-09") == "***.***.***-09"


def test_mask_cpf_none():
    assert mask_cpf(None) is None


def test_mask_telefone():
    assert mask_telefone_br("11987654321") == "(**) ****-4321"


def test_mask_telefone_none():
    assert mask_telefone_br(None) is None
