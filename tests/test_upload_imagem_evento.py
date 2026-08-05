"""Upload de imagem de capa de evento — R2 (mockado) com fallback para disco local."""

from __future__ import annotations

import io
import uuid
from unittest.mock import MagicMock, patch

from fastapi.testclient import TestClient
from PIL import Image

from app.main import app
from config.settings import settings

client = TestClient(app)


def _png_bytes(width: int = 8, height: int = 8) -> bytes:
    img = Image.new("RGB", (width, height), color=(16, 185, 129))
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


PNG_1X1 = _png_bytes(1, 1)


def _registrar_organizador(email: str) -> str:
    r = client.post(
        "/api/auth/registrar",
        json={"email": email, "nome": "Org Upload", "senha": "senha-forte-123", "tipo": "organizador"},
    )
    assert r.status_code == 200, r.text
    return r.json()["access_token"]


class TestR2StorageService:
    def test_configuracao_vazia_levanta_runtime_error(self, monkeypatch):
        from app.services.r2_storage import upload_imagem_evento

        monkeypatch.setattr(settings, "R2_ACCOUNT_ID", "")
        monkeypatch.setattr(settings, "R2_PUBLIC_URL", "")
        try:
            upload_imagem_evento(PNG_1X1, "image/png")
            assert False, "deveria ter levantado RuntimeError"
        except RuntimeError:
            pass

    def test_tipo_invalido_levanta_r2_upload_error(self, monkeypatch):
        from app.services.r2_storage import R2UploadError, upload_imagem_evento

        monkeypatch.setattr(settings, "R2_ACCOUNT_ID", "acc")
        monkeypatch.setattr(settings, "R2_ACCESS_KEY_ID", "key")
        monkeypatch.setattr(settings, "R2_SECRET_ACCESS_KEY", "secret")
        monkeypatch.setattr(settings, "R2_BUCKET_NAME", "eventosbr")
        monkeypatch.setattr(settings, "R2_PUBLIC_URL", "https://pub-x.r2.dev")
        try:
            upload_imagem_evento(PNG_1X1, "application/pdf")
            assert False, "deveria ter levantado R2UploadError"
        except R2UploadError:
            pass

    def test_arquivo_vazio_rejeitado(self, monkeypatch):
        from app.services.r2_storage import R2UploadError, upload_imagem_evento

        monkeypatch.setattr(settings, "R2_ACCOUNT_ID", "acc")
        monkeypatch.setattr(settings, "R2_ACCESS_KEY_ID", "key")
        monkeypatch.setattr(settings, "R2_SECRET_ACCESS_KEY", "secret")
        monkeypatch.setattr(settings, "R2_BUCKET_NAME", "eventosbr")
        monkeypatch.setattr(settings, "R2_PUBLIC_URL", "https://pub-x.r2.dev")
        try:
            upload_imagem_evento(b"", "image/png")
            assert False, "deveria ter levantado R2UploadError"
        except R2UploadError:
            pass

    def test_upload_sucesso_com_client_mockado(self, monkeypatch):
        from app.services import r2_storage

        monkeypatch.setattr(settings, "R2_ACCOUNT_ID", "acc")
        monkeypatch.setattr(settings, "R2_ACCESS_KEY_ID", "key")
        monkeypatch.setattr(settings, "R2_SECRET_ACCESS_KEY", "secret")
        monkeypatch.setattr(settings, "R2_BUCKET_NAME", "eventosbr")
        monkeypatch.setattr(settings, "R2_PUBLIC_URL", "https://pub-x.r2.dev/")

        mock_client = MagicMock()
        with patch("app.services.r2_storage.boto3.client", return_value=mock_client):
            url = r2_storage.upload_imagem_evento(PNG_1X1, "image/png", prefixo="eventos")

        assert url.startswith("https://pub-x.r2.dev/eventos/")
        # Pipeline recodifica para WebP quando compensar; aceita png ou webp.
        assert url.endswith(".png") or url.endswith(".webp")
        mock_client.put_object.assert_called_once()
        kwargs = mock_client.put_object.call_args.kwargs
        assert kwargs["Bucket"] == "eventosbr"
        assert kwargs["ContentType"] in ("image/png", "image/webp")


class TestUploadImagemEventoRoute:
    def test_upload_organizador_sem_r2_cai_para_disco_local(self, monkeypatch, tmp_path):
        monkeypatch.setattr(settings, "R2_ACCOUNT_ID", "")
        monkeypatch.setattr(settings, "UPLOAD_DIR", str(tmp_path))

        token = _registrar_organizador(f"upload_{uuid.uuid4().hex[:8]}@exemplo.com")
        headers = {"Authorization": f"Bearer {token}"}

        files = {"file": ("capa.png", PNG_1X1, "image/png")}
        r = client.post("/api/organizador/eventos/upload-imagem", files=files, headers=headers)
        assert r.status_code == 200, r.text
        assert "/uploads/eventos/" in r.json()["url"]

    def test_upload_cliente_bloqueado(self):
        r = client.post(
            "/api/auth/registrar",
            json={
                "email": f"cliente_upload_{uuid.uuid4().hex[:8]}@exemplo.com",
                "nome": "Cliente",
                "senha": "senha-forte-123",
                "tipo": "cliente",
            },
        )
        token = r.json()["access_token"]
        files = {"file": ("capa.png", PNG_1X1, "image/png")}
        r2 = client.post(
            "/api/organizador/eventos/upload-imagem",
            files=files,
            headers={"Authorization": f"Bearer {token}"},
        )
        assert r2.status_code == 403

    def test_upload_tipo_invalido_no_fallback_disco(self, monkeypatch, tmp_path):
        monkeypatch.setattr(settings, "R2_ACCOUNT_ID", "")
        monkeypatch.setattr(settings, "UPLOAD_DIR", str(tmp_path))

        token = _registrar_organizador(f"upload2_{uuid.uuid4().hex[:8]}@exemplo.com")
        headers = {"Authorization": f"Bearer {token}"}
        files = {"file": ("doc.pdf", b"%PDF-1.4", "application/pdf")}
        r = client.post("/api/organizador/eventos/upload-imagem", files=files, headers=headers)
        assert r.status_code == 400
