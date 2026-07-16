"""Integração sandbox real — só roda com RUN_ASAAS_SANDBOX_INTEGRATION=1."""

from __future__ import annotations

import os
import subprocess
import sys

import pytest


@pytest.mark.skipif(
    os.environ.get("RUN_ASAAS_SANDBOX_INTEGRATION") != "1",
    reason="Defina RUN_ASAAS_SANDBOX_INTEGRATION=1 e credenciais sandbox no .env",
)
def test_sandbox_compra_split_script():
    root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    proc = subprocess.run(
        [sys.executable, os.path.join(root, "scripts", "test-sandbox-compra-split.py")],
        cwd=root,
        capture_output=True,
        text=True,
        timeout=180,
    )
    assert proc.returncode == 0, proc.stderr or proc.stdout
