"""Admin integrado à conta do usuário (is_platform_admin + 2FA obrigatório)."""

from __future__ import annotations

import uuid

from fastapi.testclient import TestClient

from app.main import app
from app.services import totp as totp_service
from config.settings import settings

client = TestClient(app)

ADMIN_HEADERS = {"X-Platform-Admin-Key": "chave-admin-teste"}


def _registrar(email: str, tipo: str = "cliente") -> dict:
    r = client.post(
        "/api/auth/registrar",
        json={"email": email, "nome": "Admin Teste", "senha": "senha-forte-123", "tipo": tipo},
    )
    assert r.status_code == 200, r.text
    return r.json()


def _marcar_admin(usuario_id: str) -> None:
    r = client.patch(
        f"/api/admin/usuarios/{usuario_id}/admin",
        json={"is_platform_admin": True},
        headers=ADMIN_HEADERS,
    )
    assert r.status_code == 200, r.text


class TestTotpDisponivelParaAdmin:
    def test_cliente_sem_admin_nao_pode_ativar_totp(self):
        data = _registrar(f"cli_{uuid.uuid4().hex[:8]}@teste.com", tipo="cliente")
        headers = {"Authorization": f"Bearer {data['access_token']}"}
        r = client.post("/api/auth/2fa/iniciar", headers=headers)
        assert r.status_code == 400

    def test_cliente_admin_pode_ativar_totp(self, monkeypatch):
        monkeypatch.setattr(settings, "PLATFORM_ADMIN_API_KEY", "chave-admin-teste")
        email = f"cliadm_{uuid.uuid4().hex[:8]}@teste.com"
        data = _registrar(email, tipo="cliente")
        _marcar_admin(data["usuario"]["id"])
        headers = {"Authorization": f"Bearer {data['access_token']}"}
        r = client.post("/api/auth/2fa/iniciar", headers=headers)
        assert r.status_code == 200, r.text


class TestAcessoAdminViaSessao:
    def test_sem_2fa_acesso_negado_com_mensagem_clara(self, monkeypatch):
        monkeypatch.setattr(settings, "PLATFORM_ADMIN_API_KEY", "chave-admin-teste")
        email = f"semtotp_{uuid.uuid4().hex[:8]}@teste.com"
        data = _registrar(email, tipo="cliente")
        _marcar_admin(data["usuario"]["id"])
        headers = {"Authorization": f"Bearer {data['access_token']}"}
        r = client.get("/api/admin/setup", headers=headers)
        assert r.status_code == 403
        assert "2FA" in r.json()["detail"] or "duas etapas" in r.json()["detail"]

    def test_com_2fa_ativo_acesso_liberado(self, monkeypatch):
        monkeypatch.setattr(settings, "PLATFORM_ADMIN_API_KEY", "chave-admin-teste")
        email = f"comtotp_{uuid.uuid4().hex[:8]}@teste.com"
        data = _registrar(email, tipo="cliente")
        _marcar_admin(data["usuario"]["id"])
        headers = {"Authorization": f"Bearer {data['access_token']}"}

        setup = client.post("/api/auth/2fa/iniciar", headers=headers).json()
        codigo = totp_service.gerar_codigo_atual(setup["secret"])
        ativar = client.post("/api/auth/2fa/ativar", json={"codigo": codigo}, headers=headers)
        assert ativar.status_code == 200, ativar.text

        r = client.get("/api/admin/setup", headers=headers)
        assert r.status_code == 200, r.text

    def test_usuario_comum_sem_is_platform_admin_bloqueado(self, monkeypatch):
        monkeypatch.setattr(settings, "PLATFORM_ADMIN_API_KEY", "chave-admin-teste")
        data = _registrar(f"comum_{uuid.uuid4().hex[:8]}@teste.com", tipo="cliente")
        headers = {"Authorization": f"Bearer {data['access_token']}"}
        r = client.get("/api/admin/setup", headers=headers)
        assert r.status_code == 401

    def test_chave_estatica_continua_funcionando_sem_2fa(self, monkeypatch):
        monkeypatch.setattr(settings, "PLATFORM_ADMIN_API_KEY", "chave-admin-teste")
        r = client.get("/api/admin/setup", headers=ADMIN_HEADERS)
        assert r.status_code == 200, r.text

    def test_bloqueado_imediatamente_apos_desativar_2fa(self, monkeypatch):
        """Spec admin-integrado-usuario.md §4: desativar o próprio 2FA depois de
        já ter acesso admin bloqueia o painel na próxima requisição (checagem
        sempre em tempo real, não cacheada)."""
        monkeypatch.setattr(settings, "PLATFORM_ADMIN_API_KEY", "chave-admin-teste")
        email = f"desativa2fa_{uuid.uuid4().hex[:8]}@teste.com"
        data = _registrar(email, tipo="cliente")
        _marcar_admin(data["usuario"]["id"])
        headers = {"Authorization": f"Bearer {data['access_token']}"}

        setup = client.post("/api/auth/2fa/iniciar", headers=headers).json()
        codigo = totp_service.gerar_codigo_atual(setup["secret"])
        ativar = client.post("/api/auth/2fa/ativar", json={"codigo": codigo}, headers=headers)
        assert ativar.status_code == 200, ativar.text

        antes = client.get("/api/admin/setup", headers=headers)
        assert antes.status_code == 200, antes.text

        codigo_desativar = totp_service.gerar_codigo_atual(setup["secret"])
        desativar = client.post(
            "/api/auth/2fa/desativar",
            json={"codigo": codigo_desativar},
            headers=headers,
        )
        assert desativar.status_code == 200, desativar.text

        depois = client.get("/api/admin/setup", headers=headers)
        assert depois.status_code == 403
        assert "2FA" in depois.json()["detail"] or "duas etapas" in depois.json()["detail"]

    def test_cliente_admin_login_nao_exige_desafio_2fa(self, monkeypatch):
        """2FA de admin protege o painel, não o login da conta cliente."""
        monkeypatch.setattr(settings, "PLATFORM_ADMIN_API_KEY", "chave-admin-teste")
        email = f"cliadm_login_{uuid.uuid4().hex[:8]}@teste.com"
        senha = "senha-forte-123"
        data = _registrar(email, tipo="cliente")
        _marcar_admin(data["usuario"]["id"])
        headers = {"Authorization": f"Bearer {data['access_token']}"}

        setup = client.post("/api/auth/2fa/iniciar", headers=headers).json()
        codigo = totp_service.gerar_codigo_atual(setup["secret"])
        ativar = client.post("/api/auth/2fa/ativar", json={"codigo": codigo}, headers=headers)
        assert ativar.status_code == 200, ativar.text

        login = client.post("/api/auth/login", json={"email": email, "senha": senha})
        assert login.status_code == 200, login.text
        body = login.json()
        assert body.get("requires_2fa") is not True
        assert body.get("access_token")


class TestGerenciarAdmins:
    def test_conceder_e_revogar_admin(self, monkeypatch):
        monkeypatch.setattr(settings, "PLATFORM_ADMIN_API_KEY", "chave-admin-teste")
        data = _registrar(f"alvo_{uuid.uuid4().hex[:8]}@teste.com", tipo="cliente")
        usuario_id = data["usuario"]["id"]

        conceder = client.patch(
            f"/api/admin/usuarios/{usuario_id}/admin",
            json={"is_platform_admin": True},
            headers=ADMIN_HEADERS,
        )
        assert conceder.status_code == 200, conceder.text
        assert conceder.json()["is_platform_admin"] is True

        revogar = client.patch(
            f"/api/admin/usuarios/{usuario_id}/admin",
            json={"is_platform_admin": False},
            headers=ADMIN_HEADERS,
        )
        assert revogar.status_code == 200, revogar.text
        assert revogar.json()["is_platform_admin"] is False

    def test_listagem_inclui_is_platform_admin(self, monkeypatch):
        monkeypatch.setattr(settings, "PLATFORM_ADMIN_API_KEY", "chave-admin-teste")
        email = f"lista_{uuid.uuid4().hex[:8]}@teste.com"
        data = _registrar(email, tipo="cliente")
        _marcar_admin(data["usuario"]["id"])
        r = client.get("/api/admin/usuarios", params={"q": email}, headers=ADMIN_HEADERS)
        assert r.status_code == 200, r.text
        usuarios = r.json()["usuarios"]
        assert any(u["email"] == email and u["is_platform_admin"] is True for u in usuarios)
