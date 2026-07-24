"""2FA (TOTP) para contas de organizador: setup, ativação, login em duas etapas e recovery codes."""

from fastapi.testclient import TestClient

from app.main import app
from app.services import totp as totp_service

client = TestClient(app)


def _registrar_organizador(email: str) -> dict:
    r = client.post(
        "/api/auth/registrar",
        json={
            "email": email,
            "nome": "Organizador Teste 2FA",
            "senha": "senha-forte-123",
            "tipo": "organizador",
        },
    )
    assert r.status_code == 200, r.text
    return r.json()


def test_login_sem_2fa_retorna_token_direto():
    data = _registrar_organizador("sem2fa@exemplo.com")
    r = client.post(
        "/api/auth/login",
        json={"email": "sem2fa@exemplo.com", "senha": "senha-forte-123"},
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert "access_token" in body
    assert body["usuario"]["totp_ativado"] is False


def test_2fa_apenas_para_organizador():
    r = client.post(
        "/api/auth/registrar",
        json={
            "email": "cliente2fa@exemplo.com",
            "nome": "Cliente Teste",
            "senha": "senha-forte-123",
            "tipo": "cliente",
        },
    )
    assert r.status_code == 200, r.text
    token = r.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    r2 = client.post("/api/auth/2fa/iniciar", headers=headers)
    assert r2.status_code == 400
    assert "organizador" in r2.json()["detail"].lower()


def test_fluxo_completo_ativar_e_login_com_2fa():
    data = _registrar_organizador("organizador2fa@exemplo.com")
    token = data["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    setup = client.post("/api/auth/2fa/iniciar", headers=headers)
    assert setup.status_code == 200, setup.text
    secret = setup.json()["secret"]
    assert setup.json()["qr_base64"]

    codigo = totp_service.gerar_codigo_atual(secret)
    ativar = client.post("/api/auth/2fa/ativar", json={"codigo": codigo}, headers=headers)
    assert ativar.status_code == 200, ativar.text
    recovery_codes = ativar.json()["recovery_codes"]
    assert len(recovery_codes) == 8

    # Login normal agora exige segunda etapa.
    login = client.post(
        "/api/auth/login",
        json={"email": "organizador2fa@exemplo.com", "senha": "senha-forte-123"},
    )
    assert login.status_code == 200, login.text
    challenge = login.json()
    assert challenge["requires_2fa"] is True
    login_token = challenge["login_token"]

    # Código errado é rejeitado.
    errado = client.post(
        "/api/auth/2fa/verificar-login",
        json={"login_token": login_token, "codigo": "000000"},
    )
    assert errado.status_code == 401

    # Código certo completa o login.
    codigo2 = totp_service.gerar_codigo_atual(secret)
    ok = client.post(
        "/api/auth/2fa/verificar-login",
        json={"login_token": login_token, "codigo": codigo2},
    )
    assert ok.status_code == 200, ok.text
    assert "access_token" in ok.json()


def test_recovery_code_e_uso_unico():
    data = _registrar_organizador("organizador2farecovery@exemplo.com")
    headers = {"Authorization": f"Bearer {data['access_token']}"}

    setup = client.post("/api/auth/2fa/iniciar", headers=headers).json()
    codigo = totp_service.gerar_codigo_atual(setup["secret"])
    ativar = client.post("/api/auth/2fa/ativar", json={"codigo": codigo}, headers=headers)
    recovery_code = ativar.json()["recovery_codes"][0]

    login = client.post(
        "/api/auth/login",
        json={"email": "organizador2farecovery@exemplo.com", "senha": "senha-forte-123"},
    )
    login_token = login.json()["login_token"]

    primeiro_uso = client.post(
        "/api/auth/2fa/verificar-login",
        json={"login_token": login_token, "codigo": recovery_code},
    )
    assert primeiro_uso.status_code == 200, primeiro_uso.text

    # Reutilizar o mesmo recovery code deve falhar (uso único).
    login2 = client.post(
        "/api/auth/login",
        json={"email": "organizador2farecovery@exemplo.com", "senha": "senha-forte-123"},
    )
    login_token2 = login2.json()["login_token"]
    segundo_uso = client.post(
        "/api/auth/2fa/verificar-login",
        json={"login_token": login_token2, "codigo": recovery_code},
    )
    assert segundo_uso.status_code == 401


def test_desativar_2fa_exige_codigo_valido():
    data = _registrar_organizador("organizador2fadesativar@exemplo.com")
    headers = {"Authorization": f"Bearer {data['access_token']}"}

    setup = client.post("/api/auth/2fa/iniciar", headers=headers).json()
    codigo = totp_service.gerar_codigo_atual(setup["secret"])
    client.post("/api/auth/2fa/ativar", json={"codigo": codigo}, headers=headers)

    falha = client.post("/api/auth/2fa/desativar", json={"codigo": "000000"}, headers=headers)
    assert falha.status_code == 400

    codigo2 = totp_service.gerar_codigo_atual(setup["secret"])
    ok = client.post("/api/auth/2fa/desativar", json={"codigo": codigo2}, headers=headers)
    assert ok.status_code == 200, ok.text

    # Login volta a não exigir 2FA.
    login = client.post(
        "/api/auth/login",
        json={"email": "organizador2fadesativar@exemplo.com", "senha": "senha-forte-123"},
    )
    assert "access_token" in login.json()
