"""Regressões v1.50.13 — deps Python seguras (Pillow/FastAPI/PyJWT/pytest)."""

from __future__ import annotations

from datetime import timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def _read(*parts: str) -> str:
    return (ROOT.joinpath(*parts)).read_text(encoding="utf-8")


def test_requirements_sem_python_jose_com_versoes_seguras():
    req = _read("requirements.txt")
    assert "python-jose" not in req
    assert "PyJWT[crypto]==2.13.0" in req
    assert "fastapi==0.141.1" in req
    assert "Pillow==12.3.0" in req
    assert "pytest==9.0.3" in req
    assert "requests==2.34.2" in req


def test_auth_usa_pyjwt():
    auth = _read("app/services/auth.py")
    assert "import jwt" in auth
    assert "from jwt.exceptions import PyJWTError" in auth
    assert "from jose" not in auth
    assert "JWTError" not in auth or "PyJWTError" in auth


def test_ci_pip_audit_bloqueante():
    ci = _read(".github/workflows/ci.yml")
    assert "pip-audit -r requirements.txt" in ci
    # Não deve haver continue-on-error no step de pip-audit
    bloco = ci.split("pip-audit (bloqueante)")[1].split("prod-compose:")[0]
    assert "continue-on-error" not in bloco


def test_jwt_roundtrip_hs256():
    from app.services.auth import create_access_token, decode_token, decode_token_payload

    token = create_access_token({"sub": "42", "tv": 1}, expires_delta=timedelta(minutes=5))
    assert isinstance(token, str)
    assert decode_token(token) == "42"
    payload = decode_token_payload(token)
    assert payload is not None
    assert payload.get("sub") == "42"
    assert payload.get("tv") == 1
    assert decode_token_payload("token.invalido") is None
