"""Testes da conta mãe Asaas da plataforma."""

from __future__ import annotations

from unittest.mock import MagicMock, patch

import pytest

from app.services.asaas_plataforma import (
    assert_plataforma_pode_provisionar_contas,
    extrair_cpf_cnpj_conta,
    plataforma_pode_provisionar_contas,
)


def test_extrair_cpf_cnpj_conta():
    assert extrair_cpf_cnpj_conta({"cpfCnpj": "12.345.678/0001-90"}) == "12345678000190"
    assert extrair_cpf_cnpj_conta({"cpfCnpj": "52998224725"}) == "52998224725"


def test_plataforma_pode_provisionar_contas_cnpj():
    with patch("app.services.asaas_plataforma.consultar_conta_plataforma") as mock_consulta:
        mock_consulta.return_value = {"cpfCnpj": "12345678000190"}
        assert plataforma_pode_provisionar_contas() is True


def test_plataforma_pode_provisionar_contas_cpf():
    with patch("app.services.asaas_plataforma.consultar_conta_plataforma") as mock_consulta:
        mock_consulta.return_value = {"cpfCnpj": "52998224725"}
        assert plataforma_pode_provisionar_contas() is False


def test_assert_plataforma_pode_provisionar_contas_bloqueia_pf():
    with (
        patch("app.services.asaas_plataforma.settings") as mock_settings,
        patch("app.services.asaas_plataforma.plataforma_pode_provisionar_contas", return_value=False),
    ):
        mock_settings.permite_subconta_baas.return_value = True
        with pytest.raises(ValueError, match="configuração de pagamentos"):
            assert_plataforma_pode_provisionar_contas()
