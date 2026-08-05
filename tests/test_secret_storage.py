"""Criptografia de segredos em repouso."""

from app.utils.secret_storage import (
    _CAMPOS_MIGRAVELS,
    decrypt_at_rest,
    encrypt_at_rest,
    is_encrypted_at_rest,
    migrate_encryption,
)


def test_encrypt_decrypt_roundtrip():
    plain = "sub_key_test_abc123"
    enc = encrypt_at_rest(plain)
    assert is_encrypted_at_rest(enc)
    assert enc != plain
    assert decrypt_at_rest(enc) == plain


def test_decrypt_legacy_plaintext():
    assert decrypt_at_rest("legacy_plain_key") == "legacy_plain_key"
    assert not is_encrypted_at_rest("legacy_plain_key")


def test_encrypt_idempotent():
    plain = "same_key"
    enc1 = encrypt_at_rest(plain)
    enc2 = encrypt_at_rest(enc1)
    assert enc1 == enc2
    assert decrypt_at_rest(enc2) == plain


def test_migrate_encryption_cobre_cpf_e_totp():
    assert "asaas_subaccount_api_key" in _CAMPOS_MIGRAVELS
    assert "asaas_repasse_cpf_cnpj" in _CAMPOS_MIGRAVELS
    assert "totp_secret" in _CAMPOS_MIGRAVELS
    assert callable(migrate_encryption)
