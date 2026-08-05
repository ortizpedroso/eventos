"""Upload da logo whitelabel do organizador — proporção larga e erros de I/O."""

from __future__ import annotations

import io
import uuid
from unittest.mock import patch

from fastapi.testclient import TestClient
from PIL import Image

from app.main import app
from config.settings import settings

client = TestClient(app)


def _png_bytes(width: int, height: int) -> bytes:
    img = Image.new("RGBA", (width, height), color=(16, 185, 129, 200))
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


def _registrar_organizador(email: str) -> str:
    r = client.post(
        "/api/auth/registrar",
        json={"email": email, "nome": "Org Logo", "senha": "senha-forte-123", "tipo": "organizador"},
    )
    assert r.status_code == 200, r.text
    token = r.json().get("access_token")
    assert token, r.text
    return token


class TestUploadLogoWhitelabel:
    def test_ui_whitelabel_usa_alvo_faixa_nao_quadrado(self):
        from pathlib import Path

        src = Path("frontend/src/components/perfil-publico-organizador.tsx").read_text(encoding="utf-8")
        # Logo da marca: faixa 480×120 (não o default 512×512 do ImagemAssetField).
        assert "id=\"brand_logo_url\"" in src or "id='brand_logo_url'" in src
        assert "larguraAlvo={480}" in src
        assert "alturaAlvo={120}" in src

    def test_logo_454x116_aceita_e_persiste_no_perfil(self, monkeypatch, tmp_path):
        monkeypatch.setattr(settings, "UPLOAD_DIR", str(tmp_path))
        monkeypatch.setattr(settings, "UPLOAD_PUBLIC_BASE_URL", "https://eventosbr.app.br")
        monkeypatch.setattr(settings, "FRONTEND_PUBLIC_URL", "https://eventosbr.app.br")

        token = _registrar_organizador(f"logo_{uuid.uuid4().hex[:8]}@exemplo.com")
        headers = {"Authorization": f"Bearer {token}"}
        files = {"file": ("logo-wide.png", _png_bytes(454, 116), "image/png")}

        r = client.post("/api/organizador/assets/upload", files=files, headers=headers)
        assert r.status_code == 200, r.text
        url = r.json()["url"]
        assert "/uploads/org/" in url
        assert url.startswith("https://eventosbr.app.br/uploads/org/")
        assert url.endswith(".webp") or url.endswith(".png")

        patch_r = client.patch(
            "/api/produtor/meu-perfil",
            headers=headers,
            json={"brand_logo_url": url, "brand_name": "Marca Teste"},
        )
        assert patch_r.status_code == 200, patch_r.text
        assert patch_r.json()["brand_logo_url"] == url

    def test_content_type_com_charset_aceito(self, monkeypatch, tmp_path):
        monkeypatch.setattr(settings, "UPLOAD_DIR", str(tmp_path))
        token = _registrar_organizador(f"logo_ct_{uuid.uuid4().hex[:8]}@exemplo.com")
        headers = {"Authorization": f"Bearer {token}"}
        files = {"file": ("logo.png", _png_bytes(454, 116), "image/png; charset=utf-8")}
        r = client.post("/api/organizador/assets/upload", files=files, headers=headers)
        assert r.status_code == 200, r.text

    def test_falha_io_vira_503_nao_500_cru(self, monkeypatch, tmp_path):
        monkeypatch.setattr(settings, "UPLOAD_DIR", str(tmp_path))
        token = _registrar_organizador(f"logo_io_{uuid.uuid4().hex[:8]}@exemplo.com")
        headers = {"Authorization": f"Bearer {token}"}
        files = {"file": ("logo.png", _png_bytes(100, 40), "image/png")}

        with patch("pathlib.Path.write_bytes", side_effect=OSError("Read-only file system")):
            r = client.post("/api/organizador/assets/upload", files=files, headers=headers)

        assert r.status_code == 503, r.text
        detail = str(r.json().get("detail", "")).lower()
        assert "imagem" in detail or "armazenamento" in detail or "gravar" in detail
