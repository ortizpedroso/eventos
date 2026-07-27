"""Lembrar dispositivo — pula o desafio 2FA por até 30 dias no mesmo navegador."""

from __future__ import annotations

import uuid

from fastapi.testclient import TestClient

from app.main import app
from app.services import totp as totp_service

client = TestClient(app)


def _criar_conta_com_2fa(email: str) -> tuple[str, str]:
    r = client.post(
        "/api/auth/registrar",
        json={"email": email, "nome": "Teste 2FA", "senha": "senha-forte-123", "tipo": "organizador"},
    )
    assert r.status_code == 200, r.text
    token = r.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    setup = client.post("/api/auth/2fa/iniciar", headers=headers).json()
    codigo = totp_service.gerar_codigo_atual(setup["secret"])
    ativar = client.post("/api/auth/2fa/ativar", json={"codigo": codigo}, headers=headers)
    assert ativar.status_code == 200, ativar.text
    return setup["secret"], token


class TestLembrarDispositivo:
    def test_login_normal_ainda_pede_2fa(self):
        email = f"lembra1_{uuid.uuid4().hex[:8]}@teste.com"
        _criar_conta_com_2fa(email)
        r = client.post("/api/auth/login", json={"email": email, "senha": "senha-forte-123"})
        assert r.status_code == 200
        assert "login_token" in r.json()

    def test_lembrar_dispositivo_pula_2fa_no_proximo_login(self):
        email = f"lembra2_{uuid.uuid4().hex[:8]}@teste.com"
        secret, _ = _criar_conta_com_2fa(email)

        # Login normal -> desafio 2FA
        login1 = client.post("/api/auth/login", json={"email": email, "senha": "senha-forte-123"})
        login_token = login1.json()["login_token"]

        # Verifica com lembrar_dispositivo=True -> deve setar o cookie de dispositivo confiável
        codigo = totp_service.gerar_codigo_atual(secret)
        verificar = client.post(
            "/api/auth/2fa/verificar-login",
            json={"login_token": login_token, "codigo": codigo, "lembrar_dispositivo": True},
        )
        assert verificar.status_code == 200, verificar.text
        assert "eventosbr_2fa_trusted" in client.cookies

        # Próximo login (mesmo client/cookies) -> não deve pedir 2FA de novo
        login2 = client.post("/api/auth/login", json={"email": email, "senha": "senha-forte-123"})
        assert login2.status_code == 200, login2.text
        assert "access_token" in login2.json()
        assert "login_token" not in login2.json()

    def test_sem_lembrar_dispositivo_continua_pedindo_2fa(self):
        email = f"lembra3_{uuid.uuid4().hex[:8]}@teste.com"
        secret, _ = _criar_conta_com_2fa(email)

        login1 = client.post("/api/auth/login", json={"email": email, "senha": "senha-forte-123"})
        login_token = login1.json()["login_token"]
        codigo = totp_service.gerar_codigo_atual(secret)
        client.post(
            "/api/auth/2fa/verificar-login",
            json={"login_token": login_token, "codigo": codigo, "lembrar_dispositivo": False},
        )
        client.cookies.clear()

        login2 = client.post("/api/auth/login", json={"email": email, "senha": "senha-forte-123"})
        assert "login_token" in login2.json()
