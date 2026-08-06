"""Cancelamento de ingresso gratuito/cortesia sem reembolso no gateway."""

from __future__ import annotations

from unittest.mock import patch

from app.models import Ingresso
from app.services.ingresso_pago import ingresso_requer_reembolso_gateway
from tests import test_fase_b as fb

client = fb.client


def test_ingresso_requer_reembolso_gateway():
    ing_gratis = Ingresso(valor=0.0, asaas_payment_id="pay_xyz")
    ing_cortesia = Ingresso(valor=0.0, asaas_payment_id="cortesia_abc")
    ing_pdv = Ingresso(valor=0.0, asaas_payment_id="pdv_abc")
    ing_pago = Ingresso(valor=50.0, asaas_payment_id="pay_xyz")

    assert ingresso_requer_reembolso_gateway(ing_gratis) is False
    assert ingresso_requer_reembolso_gateway(ing_cortesia) is False
    assert ingresso_requer_reembolso_gateway(ing_pdv) is False
    assert ingresso_requer_reembolso_gateway(ing_pago) is True
    assert ingresso_requer_reembolso_gateway(ing_pago, payments_disabled=True) is False


def test_cancelar_ingresso_cortesia_sem_chamar_asaas():
    org = fb._registrar_organizador("cancel_cort")
    cli = fb._registrar_cliente("cancel_cort")
    ev = fb._criar_evento(
        org,
        ingresso_lotes=[
            {"nome": "Cortesia", "tipo": "cortesia", "preco": 0, "ordem": 1, "ativo": True},
        ],
    )
    criar = client.post(
        "/api/pagamentos/criar",
        headers={"Authorization": f"Bearer {cli}"},
        json={"evento_id": ev["id"], "valor_centavos": 0, "termo_compra_aceito": True},
    )
    assert criar.status_code == 200, criar.text
    ingresso_id = criar.json()["ingresso_id"]

    with patch("app.routes.pagamentos.cancelar_com_reembolso_asaas") as refund_mock:
        cancel = client.post(
            "/api/pagamentos/cancelar",
            headers={"Authorization": f"Bearer {cli}"},
            json={"ingresso_id": ingresso_id},
        )
        refund_mock.assert_not_called()

    assert cancel.status_code == 200, cancel.text
    body = cancel.json()
    assert body["valor_reembolso"] == 0
    assert body.get("refund_id") is None
