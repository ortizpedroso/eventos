"""Item 3 (modo offline no check-in da portaria — escopo reduzido, sem localStorage/IndexedDB)."""

from __future__ import annotations

from pathlib import Path

CHECKIN_CLIENT = Path("frontend/src/components/checkin-portaria-client.tsx").read_text(encoding="utf-8")
API_LIB = Path("frontend/src/lib/api.ts").read_text(encoding="utf-8")
PORTARIA_ROUTE = Path("app/routes/portaria.py").read_text(encoding="utf-8")
CHECKIN_SERVICE = Path("app/services/ingresso_checkin.py").read_text(encoding="utf-8")


def test_api_distingue_falha_de_rede_de_erro_http():
    assert "export class ApiNetworkError extends Error {}" in API_LIB
    assert "throw new ApiNetworkError(" in API_LIB


def test_backend_expoe_endpoint_de_ids_validos_para_preload():
    assert '@router.get("/ids-validos"' in PORTARIA_ROUTE
    assert "listar_ids_validos_portaria" in PORTARIA_ROUTE
    assert "def listar_ids_validos_portaria(" in CHECKIN_SERVICE


def test_checkin_portaria_pre_carrega_ids_validos_ao_abrir():
    assert "carregarIdsValidos" in CHECKIN_CLIENT
    assert "/api/portaria/ids-validos" in CHECKIN_CLIENT
    # Preload só se aplica ao modo portaria (escopo de um único evento).
    assert 'if (modo !== "portaria" || !eventoId || !token) return;' in CHECKIN_CLIENT


def test_checkin_portaria_usa_fallback_local_em_falha_de_rede():
    assert "validarOffline" in CHECKIN_CLIENT
    assert "err instanceof ApiNetworkError" in CHECKIN_CLIENT
    assert "Verificado offline — sincronize quando a internet voltar." in CHECKIN_CLIENT
    # Fallback não verifica assinatura HMAC (segredo indisponível no cliente).
    assert "extrairIngressoIdSemAssinatura" in CHECKIN_CLIENT


def test_checkin_offline_enfileira_e_sincroniza_ao_reconectar():
    assert "filaOfflineRef" in CHECKIN_CLIENT
    assert "sincronizarFila" in CHECKIN_CLIENT
    assert 'window.addEventListener("online"' in CHECKIN_CLIENT
