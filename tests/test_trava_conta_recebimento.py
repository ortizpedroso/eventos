"""Travas contra evento pago com conta de recebimento falsa e cadastro com e-mail temporário."""

from __future__ import annotations

import uuid
from unittest.mock import patch

import pytest

from app.services.asaas_e2e_mock import MOCK_API_KEY_WALLET_PREFIX
from app.services.organizador_asaas import validar_wallet_repasse
from app.utils.email_descartavel import email_descartavel
from config.settings import settings
from tests import test_api

WALLET = "aaaa1111-eeee-2222-cccc-333344445566"


@pytest.fixture
def asaas_ativo():
    with patch.multiple(
        settings,
        ENVIRONMENT="test",
        ASAAS_E2E_MOCK=True,
        ASAAS_DISABLED=False,
        ASAAS_API_KEY="e2e-mock-key",
        ASAAS_PLATFORM_WALLET_ID="bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
        PAYMENT_PROVIDER="asaas",
    ):
        yield


def _organizador() -> dict[str, str]:
    reg = test_api.client.post(
        "/api/auth/registrar",
        json={
            "email": f"trava-{uuid.uuid4().hex[:8]}@test.com",
            "nome": "Org",
            "senha": "senha12345",
            "tipo": "organizador",
        },
    )
    assert reg.status_code == 200, reg.text
    return {"Authorization": f"Bearer {reg.json()['access_token']}"}


def _evento(preco: float, publicado: bool) -> dict:
    return {
        "nome": f"Show {uuid.uuid4().hex[:6]}",
        "descricao": "Show",
        "data_inicio": "2027-03-01T20:00:00",
        "data_fim": "2027-03-01T23:00:00",
        "local": "Porto Alegre",
        "preco_ingresso": preco,
        "categoria": "Outros",
        "contato_telefone": "51999990000",
        "contato_email": "contato@show.com",
        "publicado": publicado,
        "ingresso_lotes": [
            {"nome": "Geral", "preco": preco, "ordem": 1, "ativo": True, "tipo": "inteira" if preco else "cortesia"}
        ],
    }


def test_carteira_que_nao_e_uuid_e_recusada():
    with pytest.raises(ValueError):
        validar_wallet_repasse("00000000", api_key_organizador="qualquer")


def test_vincular_carteira_sem_chave_de_api_e_recusado(asaas_ativo):
    auth = _organizador()
    r = test_api.client.put("/api/organizador/asaas/wallet", headers=auth, json={"wallet_id": WALLET})
    assert r.status_code == 400
    assert "chave de API" in r.json()["detail"]


def test_chave_de_outra_conta_nao_vincula_a_carteira(asaas_ativo):
    auth = _organizador()
    outra = "cccc1111-eeee-2222-cccc-333344445566"
    r = test_api.client.put(
        "/api/organizador/asaas/wallet",
        headers=auth,
        json={"wallet_id": WALLET, "api_key": f"{MOCK_API_KEY_WALLET_PREFIX}{outra}"},
    )
    assert r.status_code == 400


def test_chave_da_propria_conta_vincula_e_libera_evento_pago(asaas_ativo):
    auth = _organizador()
    r = test_api.client.put(
        "/api/organizador/asaas/wallet",
        headers=auth,
        json={"wallet_id": WALLET, "api_key": f"{MOCK_API_KEY_WALLET_PREFIX}{WALLET}"},
    )
    assert r.status_code == 200, r.text
    assert r.json()["verificado_api"] is True

    ev = test_api.client.post("/api/eventos/criar", headers=auth, json=_evento(40, publicado=True))
    assert ev.status_code == 200, ev.text


def test_evento_publicado_nao_vira_pago_sem_conta_de_recebimento(asaas_ativo):
    auth = _organizador()
    ev = test_api.client.post("/api/eventos/criar", headers=auth, json=_evento(0, publicado=True))
    assert ev.status_code == 200, ev.text

    corpo = _evento(35, publicado=True)
    del corpo["publicado"]
    r = test_api.client.patch(f"/api/eventos/id/{ev.json()['id']}", headers=auth, json=corpo)
    assert r.status_code == 400, r.text

    publico = test_api.client.get(f"/api/eventos/{ev.json()['slug']}").json()
    assert publico["preco_ingresso"] == 0


@pytest.mark.parametrize(
    "email",
    ["x@euploading.com", "x@mailinator.com", "x@sub.yopmail.com", "x@YOPMAIL.COM"],
)
def test_cadastro_com_email_temporario_e_recusado(email):
    r = test_api.client.post(
        "/api/auth/registrar",
        json={"email": email, "nome": "Teste", "senha": "senha12345", "tipo": "cliente"},
    )
    assert r.status_code == 400
    assert "temporários" in r.json()["detail"]


def test_email_comum_nao_e_considerado_temporario():
    assert not email_descartavel("ana@gmail.com")
    assert not email_descartavel("contato@agenciadovale.com.br")
