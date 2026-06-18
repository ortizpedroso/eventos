"""Criptografia de segredos em repouso."""

from app.utils.secret_storage import decrypt_at_rest, encrypt_at_rest, is_encrypted_at_rest


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
