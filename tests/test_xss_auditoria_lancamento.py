"""Auditoria de segurança — XSS (rodada 1 de lançamento)."""

from __future__ import annotations

import json
import subprocess
import uuid
from pathlib import Path

from fastapi.testclient import TestClient

from app.main import app
from app.services.asset_storage import upload_root
from config.settings import settings

client = TestClient(app)

ADMIN_HEADERS = {"X-Platform-Admin-Key": "chave-admin-xss-test"}


def _node_eval(script: str) -> str:
    r = subprocess.run(
        ["node", "--experimental-strip-types", "--input-type=module", "-e", script],
        capture_output=True,
        text=True,
        check=False,
    )
    assert r.returncode == 0, f"stdout={r.stdout}\nstderr={r.stderr}"
    return r.stdout.strip()


def test_upload_svg_com_script_rejeitado_admin(monkeypatch):
    monkeypatch.setattr(settings, "PLATFORM_ADMIN_API_KEY", "chave-admin-xss-test")
    payload = b"<svg onload=alert(1)><script>alert(1)</script></svg>"
    before = list(upload_root().rglob("*.svg"))

    resp = client.post(
        "/api/admin/assets/upload",
        files={"file": ("evil.svg", payload, "image/svg+xml")},
        headers=ADMIN_HEADERS,
    )

    assert resp.status_code == 400, resp.text
    detail = resp.json()["detail"].lower()
    assert "jpeg" in detail or "não permitido" in detail or "permitido" in detail
    after = list(upload_root().rglob("*.svg"))
    assert after == before


def test_upload_svg_com_script_rejeitado_organizador(monkeypatch):
    monkeypatch.setattr(settings, "PLATFORM_ADMIN_API_KEY", "chave-admin-xss-test")
    email = f"org.xss.{uuid.uuid4().hex[:8]}@test.com"
    reg = client.post(
        "/api/auth/registrar",
        json={"email": email, "nome": "Org XSS", "senha": "senha-forte-123", "tipo": "organizador"},
    )
    assert reg.status_code == 200, reg.text
    token = reg.json()["access_token"]
    payload = b"<svg onload=alert(1)><script>alert(1)</script></svg>"

    resp = client.post(
        "/api/organizador/assets/upload",
        files={"file": ("evil.svg", payload, "image/svg+xml")},
        headers={"Authorization": f"Bearer {token}"},
    )

    assert resp.status_code == 400, resp.text


def test_json_ld_escape_neutraliza_fechamento_de_script():
    malicious = "</script><script>window.__xss=1</script>"
    out = _node_eval(
        f"""
import {{ serializeJsonLdForScript }} from "./frontend/src/lib/json-ld-html.ts";
const data = {{ name: {json.dumps(malicious)} }};
console.log(serializeJsonLdForScript(data));
"""
    )
    assert "</script><script>" not in out
    assert "\\u003c" in out and "script" in out
    assert "window.__xss" in out


def test_page_evento_usa_serialize_json_ld_para_scripts():
    page = Path("frontend/src/app/eventos/[slug]/page.tsx").read_text(encoding="utf-8")
    assert "serializeJsonLdForScript" in page
    assert "dangerouslySetInnerHTML" in page
    assert "return JSON.stringify(jsonLd)" not in page
    assert "return JSON.stringify({" not in page
