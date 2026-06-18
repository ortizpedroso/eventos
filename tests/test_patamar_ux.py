"""Testes patamar completo UX/produto."""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone

import pytest
from slugify import slugify

from app.models import Evento, Ingresso, Usuario
from app.services.eventos_relacionados import listar_eventos_relacionados
from app.services.ingresso_pago import marcar_ingresso_pago
from app.services.lista_espera import (
    expirar_tokens_vencidos,
    inscrever_espera,
    janela_exclusiva_espera_ativa,
    liberar_vagas_apos_cancelamento,
    validar_token_espera,
)
from app.services.lista_interesse import inscrever_interesse
from app.services.taxas_asaas_publicas import calcular_taxa_asaas, simular_parcelas
from app.services.urgencia import calcular_urgencia
from tests import test_api


def _db():
    return test_api.TestingSessionLocal()


def _criar_evento(db, org_id: str, nome: str = "Show Teste") -> Evento:
    ev = Evento(
        nome=nome,
        descricao="desc",
        data_inicio=datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(days=7),
        data_fim=datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(days=7, hours=3),
        local="Rua A, 1",
        cidade="São Paulo",
        categoria="Shows",
        preco_ingresso=50.0,
        organizador_id=org_id,
        slug=slugify(f"{nome}-{org_id[:8]}"),
        publicado=True,
        aceita_interesse=True,
        lista_espera_habilitada=True,
    )
    db.add(ev)
    db.commit()
    db.refresh(ev)
    return ev


def _criar_org(db) -> Usuario:
    org = Usuario(
        email=f"org-{slugify(str(datetime.now().timestamp()))}@ex.com",
        nome="Org Teste",
        senha_hash="x",
        tipo="organizador",
    )
    db.add(org)
    db.commit()
    db.refresh(org)
    return org


def test_taxas_asaas_pix():
    assert calcular_taxa_asaas(100.0, "pix") == 1.99


def test_simular_parcelas():
    r = simular_parcelas(120.0, 3)
    assert r["parcelas"] == 3
    assert r["valor_parcela"] == 40.0


def test_urgencia_exato():
    b = calcular_urgencia("exato", restantes=7)
    assert b.ativo and "7" in (b.texto or "")


def test_urgencia_sem_estoque_conhecido():
    b = calcular_urgencia("exato", restantes=None)
    assert not b.ativo
    b2 = calcular_urgencia("faixa", restantes=None)
    assert not b2.ativo


def test_lista_interesse_dedup():
    db = _db()
    try:
        org = _criar_org(db)
        ev = _criar_evento(db, org.id)
        a = inscrever_interesse(db, ev, email="teste@exemplo.com", nome="A")
        b = inscrever_interesse(db, ev, email="teste@exemplo.com", nome="B")
        assert a.id == b.id
    finally:
        db.close()


def test_lista_espera_fifo():
    db = _db()
    try:
        org = _criar_org(db)
        ev = _criar_evento(db, org.id)
        e1 = inscrever_espera(db, ev, email="a@ex.com", nome="A")
        e2 = inscrever_espera(db, ev, email="b@ex.com", nome="B")
        assert e1.posicao == 1
        assert e2.posicao == 2
    finally:
        db.close()


def test_lista_espera_liberacao(monkeypatch):
    db = _db()
    try:
        org = _criar_org(db)
        ev = _criar_evento(db, org.id)
        ev.lista_espera_prazo_horas = 24
        db.commit()
        entrada = inscrever_espera(db, ev, email="fila@ex.com")
        emails: list[str] = []
        monkeypatch.setattr(
            "app.services.lista_espera.enqueue_email_simples",
            lambda dest, subj, html: emails.append(dest) or True,
        )
        n = liberar_vagas_apos_cancelamento(db, ev.id, 1)
        assert n == 1
        db.refresh(entrada)
        assert entrada.status == "notificado"
        assert entrada.token_compra
        assert emails == ["fila@ex.com"]
        ok = validar_token_espera(db, ev, entrada.token_compra)
        assert ok is not None
    finally:
        db.close()


def test_lista_espera_marcada_comprada_apos_pagamento():
    db = _db()
    try:
        org = _criar_org(db)
        ev = _criar_evento(db, org.id)
        entrada = inscrever_espera(db, ev, email="comprador@ex.com")
        entrada.status = "notificado"
        entrada.token_compra = "tok-test"
        db.commit()
        ing = Ingresso(
            evento_id=ev.id,
            usuario_id=org.id,
            participante_email="comprador@ex.com",
            valor=50.0,
            status="pendente",
        )
        db.add(ing)
        db.commit()
        db.refresh(ing)
        assert marcar_ingresso_pago(db, ing)
        db.commit()
        db.refresh(entrada)
        assert entrada.status == "comprado"
        assert entrada.token_compra is None
    finally:
        db.close()


def test_lista_espera_expiracao_token(monkeypatch):
    db = _db()
    try:
        org = _criar_org(db)
        ev = _criar_evento(db, org.id)
        ev.lista_espera_prazo_horas = 24
        db.commit()
        e1 = inscrever_espera(db, ev, email="a@ex.com")
        e2 = inscrever_espera(db, ev, email="b@ex.com")
        monkeypatch.setattr(
            "app.services.lista_espera.enqueue_email_simples",
            lambda dest, subj, html: True,
        )
        liberar_vagas_apos_cancelamento(db, ev.id, 1)
        db.refresh(e1)
        assert e1.status == "notificado"
        e1.token_expira_em = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(hours=1)
        db.commit()
        n = expirar_tokens_vencidos(db)
        assert n >= 1
        db.refresh(e1)
        assert e1.status == "expirado"
        db.refresh(e2)
        assert e2.status == "notificado"
    finally:
        db.close()


def test_eventos_relacionados_prioridade_organizador():
    db = _db()
    try:
        org = _criar_org(db)
        ev = _criar_evento(db, org.id, "Evento base")
        outro = Evento(
            nome="Outro do mesmo org",
            descricao="d",
            data_inicio=ev.data_inicio + timedelta(days=1),
            data_fim=ev.data_fim + timedelta(days=1),
            local="Local",
            cidade=ev.cidade,
            categoria=ev.categoria,
            preco_ingresso=20,
            organizador_id=ev.organizador_id,
            slug=slugify("outro-org-test"),
            publicado=True,
        )
        db.add(outro)
        db.commit()
        rel = listar_eventos_relacionados(db, ev, limite=4)
        assert any(r.organizador_id == ev.organizador_id for r in rel)
    finally:
        db.close()


def test_janela_exclusiva_espera():
    db = _db()
    try:
        org = _criar_org(db)
        ev = _criar_evento(db, org.id)
        assert not janela_exclusiva_espera_ativa(db, ev.id)
        entrada = inscrever_espera(db, ev, email="fila@ex.com")
        entrada.status = "notificado"
        entrada.token_compra = f"tok-janela-{uuid.uuid4().hex[:8]}"
        entrada.token_expira_em = datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(hours=24)
        db.commit()
        assert janela_exclusiva_espera_ativa(db, ev.id)
    finally:
        db.close()


def test_validar_compra_com_token_espera():
    import pytest
    from fastapi import HTTPException

    from app.services.lista_espera import validar_compra_com_token_espera

    db = _db()
    try:
        org = _criar_org(db)
        ev = _criar_evento(db, org.id)
        entrada = inscrever_espera(db, ev, email="comprador@ex.com")
        entrada.status = "notificado"
        entrada.token_compra = "tok-compra"
        entrada.token_expira_em = datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(hours=24)
        db.commit()
        with pytest.raises(HTTPException) as exc:
            validar_compra_com_token_espera(db, ev, None, "comprador@ex.com")
        assert exc.value.status_code == 403
        validar_compra_com_token_espera(db, ev, "tok-compra", "comprador@ex.com")
    finally:
        db.close()


def test_cancelar_pendentes_libera_lista_espera(monkeypatch):
    db = _db()
    try:
        org = _criar_org(db)
        ev = _criar_evento(db, org.id)
        fila = inscrever_espera(db, ev, email="proximo@ex.com")
        ing = Ingresso(
            evento_id=ev.id,
            usuario_id=org.id,
            participante_email="outro@ex.com",
            valor=50.0,
            status="pendente",
            asaas_payment_id="pay_cleanup",
        )
        db.add(ing)
        db.commit()
        emails: list[str] = []
        monkeypatch.setattr(
            "app.services.lista_espera.enqueue_email_simples",
            lambda dest, subj, html: emails.append(dest) or True,
        )
        from app.services.ingresso_pago import cancelar_ingressos_pi_pendentes

        n = cancelar_ingressos_pi_pendentes(db, "pay_cleanup")
        assert n == 1
        db.refresh(fila)
        assert fila.status == "notificado"
        assert emails == ["proximo@ex.com"]
    finally:
        db.close()


def test_cancelar_reembolsados_marca_pago_como_cancelado():
    db = _db()
    try:
        org = _criar_org(db)
        ev = _criar_evento(db, org.id)
        ing = Ingresso(
            evento_id=ev.id,
            usuario_id=org.id,
            valor=50.0,
            status="pago",
            asaas_payment_id="pay_refund",
        )
        db.add(ing)
        db.commit()
        db.refresh(ing)
        from app.services.ingresso_pago import cancelar_ingressos_reembolsados

        n = cancelar_ingressos_reembolsados(db, "pay_refund")
        assert n == 1
        db.commit()
        db.refresh(ing)
        assert ing.status == "cancelado"
    finally:
        db.close()


def test_validar_espera_para_ingresso_pendente_bloqueia_terceiro():
    import pytest
    from fastapi import HTTPException

    from app.services.lista_espera import (
        inscrever_espera,
        validar_espera_para_ingresso_pendente,
    )

    db = _db()
    try:
        org = _criar_org(db)
        ev = _criar_evento(db, org.id)
        entrada = inscrever_espera(db, ev, email="fila@ex.com")
        entrada.status = "notificado"
        entrada.token_compra = f"tok-janela-{uuid.uuid4().hex[:8]}"
        entrada.token_expira_em = datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(hours=24)
        db.commit()

        ing = Ingresso(
            evento_id=ev.id,
            usuario_id=org.id,
            participante_email="outro@ex.com",
            valor=50.0,
            status="pendente",
            reservado_ate=datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(minutes=30),
        )
        db.add(ing)
        db.commit()

        with pytest.raises(HTTPException) as exc:
            validar_espera_para_ingresso_pendente(db, ing, None)
        assert exc.value.status_code == 403
    finally:
        db.close()


def test_validar_espera_para_ingresso_pendente_permite_notificado():
    from app.services.lista_espera import (
        inscrever_espera,
        validar_espera_para_ingresso_pendente,
    )

    db = _db()
    try:
        org = _criar_org(db)
        ev = _criar_evento(db, org.id)
        entrada = inscrever_espera(db, ev, email="fila@ex.com")
        entrada.status = "notificado"
        token = f"tok-janela-{uuid.uuid4().hex[:8]}"
        entrada.token_compra = token
        entrada.token_expira_em = datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(hours=24)
        db.commit()

        ing = Ingresso(
            evento_id=ev.id,
            usuario_id=org.id,
            participante_email="fila@ex.com",
            valor=50.0,
            status="pendente",
            reservado_ate=datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(minutes=30),
        )
        db.add(ing)
        db.commit()

        validar_espera_para_ingresso_pendente(db, ing, None)
        validar_espera_para_ingresso_pendente(db, ing, token)
    finally:
        db.close()


def test_marcar_ingresso_pago_bloqueia_bypass_espera():
    from app.services.lista_espera import inscrever_espera
    from app.services.ingresso_pago import marcar_ingresso_pago

    db = _db()
    try:
        org = _criar_org(db)
        ev = _criar_evento(db, org.id)
        entrada = inscrever_espera(db, ev, email="fila@ex.com")
        entrada.status = "notificado"
        entrada.token_compra = f"tok-janela-{uuid.uuid4().hex[:8]}"
        entrada.token_expira_em = datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(hours=24)
        db.commit()

        ing = Ingresso(
            evento_id=ev.id,
            usuario_id=org.id,
            participante_email="outro@ex.com",
            valor=50.0,
            status="pendente",
            asaas_payment_id="pay_bypass",
        )
        db.add(ing)
        db.commit()

        assert marcar_ingresso_pago(db, ing) is False
        assert ing.status == "pendente"
    finally:
        db.close()


def test_expirar_espera_reserva_nao_concluida():
    from app.services.lista_espera import (
        expirar_espera_reserva_nao_concluida,
        inscrever_espera,
        janela_exclusiva_espera_ativa,
    )

    db = _db()
    try:
        org = _criar_org(db)
        ev = _criar_evento(db, org.id)
        entrada = inscrever_espera(db, ev, email="fila@ex.com")
        entrada.status = "notificado"
        entrada.token_compra = f"tok-{uuid.uuid4().hex[:8]}"
        entrada.token_expira_em = datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(hours=24)
        db.commit()
        assert janela_exclusiva_espera_ativa(db, ev.id)

        ing = Ingresso(
            evento_id=ev.id,
            usuario_id=org.id,
            participante_email="fila@ex.com",
            valor=50.0,
            status="pendente",
            reservado_ate=datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(minutes=1),
        )
        db.add(ing)
        db.commit()

        assert expirar_espera_reserva_nao_concluida(db, ing) is True
        db.commit()
        db.refresh(entrada)
        assert entrada.status == "expirado"
        assert entrada.token_compra is None
        assert not janela_exclusiva_espera_ativa(db, ev.id)
    finally:
        db.close()


def test_cleanup_reserva_expira_espera_notificado(monkeypatch):
    from app.models import EventoListaEspera
    from app.services.lista_espera import inscrever_espera, janela_exclusiva_espera_ativa
    from app.services.reserva_cleanup import cancelar_reservas_expiradas

    db = _db()
    try:
        org = _criar_org(db)
        ev = _criar_evento(db, org.id)
        entrada_a = inscrever_espera(db, ev, email="comprador@ex.com")
        entrada_a.status = "notificado"
        entrada_a.token_compra = f"tok-a-{uuid.uuid4().hex[:8]}"
        entrada_a.token_expira_em = datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(hours=24)
        id_a = entrada_a.id
        entrada_b = inscrever_espera(db, ev, email="proximo@ex.com")
        id_b = entrada_b.id
        db.commit()

        ing = Ingresso(
            evento_id=ev.id,
            usuario_id=org.id,
            participante_email="comprador@ex.com",
            valor=50.0,
            status="pendente",
            reservado_ate=datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(minutes=5),
        )
        db.add(ing)
        db.commit()
        ing_id = ing.id
        ev_id = ev.id

        emails: list[str] = []
        monkeypatch.setattr(
            "app.services.lista_espera.enqueue_email_simples",
            lambda dest, subj, html: emails.append(dest) or True,
        )
        monkeypatch.setattr("app.services.reserva_cleanup.SessionLocal", _db)

        n = cancelar_reservas_expiradas()
        assert n >= 1

        db2 = _db()
        ing_after = db2.get(Ingresso, ing_id)
        assert ing_after is not None
        assert ing_after.status == "cancelado"
        entrada_a = db2.get(EventoListaEspera, id_a)
        entrada_b = db2.get(EventoListaEspera, id_b)
        assert entrada_a is not None
        assert entrada_b is not None
        assert entrada_a.status == "expirado"
        assert entrada_b.status == "notificado"
        assert emails == ["proximo@ex.com"]
        assert janela_exclusiva_espera_ativa(db2, ev_id)
        db2.close()
    finally:
        db.close()


def test_ingressos_gratis_marca_espera_comprada():
    from app.models import EventoListaEspera
    from app.services.lista_espera import inscrever_espera

    db = _db()
    try:
        org = _criar_org(db)
        ev = _criar_evento(db, org.id)
        entrada = inscrever_espera(db, ev, email="cortesia@ex.com")
        entrada.status = "notificado"
        entrada.token_compra = f"tok-{uuid.uuid4().hex[:8]}"
        entrada.token_expira_em = datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(hours=24)
        db.commit()

        from app.services.lista_espera import marcar_espera_comprada

        marcar_espera_comprada(db, ev.id, "cortesia@ex.com")
        db.commit()
        db.refresh(entrada)
        assert entrada.status == "comprado"
        assert entrada.token_compra is None
    finally:
        db.close()


def test_status_cobranca_pago_reflete_ingresso_local():
    from unittest.mock import patch

    from app.services.pagamentos_asaas_handlers import status_cobranca_asaas

    db = _db()
    try:
        org = _criar_org(db)
        ev = _criar_evento(db, org.id, nome="Poll evento")
        ing = Ingresso(
            evento_id=ev.id,
            usuario_id=org.id,
            participante_email="buyer@ex.com",
            valor=50.0,
            status="pendente",
            asaas_payment_id="pay_poll",
        )
        db.add(ing)
        db.commit()
        iid = ing.id

        with (
            patch(
                "app.services.pagamentos_asaas_handlers.obter_cobranca",
                return_value={"status": "CONFIRMED", "id": "pay_poll"},
            ),
            patch(
                "app.services.pagamentos_asaas_handlers.processar_cobranca_confirmada_gateway",
                return_value=[],
            ),
        ):
            out = status_cobranca_asaas(db, iid, org)
        assert out["pago"] is False
        db.refresh(ing)
        assert ing.status == "pendente"
    finally:
        db.close()


def test_liberar_vagas_respeita_janela_exclusiva_ativa(monkeypatch):
    from app.services.lista_espera import inscrever_espera, liberar_vagas_apos_cancelamento

    db = _db()
    try:
        org = _criar_org(db)
        ev = _criar_evento(db, org.id)
        entrada_a = inscrever_espera(db, ev, email="ativo@ex.com")
        entrada_a.status = "notificado"
        entrada_a.token_compra = f"tok-{uuid.uuid4().hex[:8]}"
        entrada_a.token_expira_em = datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(hours=24)
        entrada_b = inscrever_espera(db, ev, email="fila@ex.com")
        db.commit()

        emails: list[str] = []
        monkeypatch.setattr(
            "app.services.lista_espera.enqueue_email_simples",
            lambda dest, subj, html: emails.append(dest) or True,
        )

        n = liberar_vagas_apos_cancelamento(db, ev.id, 1)
        assert n == 0
        assert emails == []

        db.refresh(entrada_b)
        assert entrada_b.status == "aguardando"
    finally:
        db.close()


def test_retomar_asaas_nao_reporta_ja_pago_sem_ingresso_pago():
    from unittest.mock import patch

    import pytest
    from fastapi import HTTPException

    from app.services.pagamentos_asaas_handlers import retomar_pagamento_asaas

    db = _db()
    try:
        org = _criar_org(db)
        ev = _criar_evento(db, org.id)
        ing = Ingresso(
            evento_id=ev.id,
            usuario_id=org.id,
            participante_email="outro@ex.com",
            valor=50.0,
            status="pendente",
            asaas_payment_id="pay_retomar",
            reservado_ate=datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(minutes=30),
        )
        db.add(ing)
        db.commit()
        db.refresh(ing)

        entrada = inscrever_espera(db, ev, email="fila@ex.com")
        entrada.status = "notificado"
        entrada.token_compra = f"tok-{uuid.uuid4().hex[:8]}"
        entrada.token_expira_em = datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(hours=24)
        db.commit()

        with (
            patch(
                "app.services.pagamentos_asaas_handlers.obter_cobranca",
                return_value={"status": "CONFIRMED", "id": "pay_retomar"},
            ),
            patch(
                "app.services.pagamentos_asaas_handlers.processar_cobranca_confirmada_gateway",
                return_value=[],
            ),
        ):
            with pytest.raises(HTTPException) as exc:
                retomar_pagamento_asaas(db, ing)
        assert exc.value.status_code == 409
        db.refresh(ing)
        assert ing.status == "pendente"
    finally:
        db.close()


def test_iniciar_cobranca_nao_recria_quando_gateway_pago():
    from unittest.mock import patch

    import pytest
    from fastapi import HTTPException

    from app.services.pagamentos_asaas_handlers import (
        AsaasCobrancaRequest,
        iniciar_cobranca_asaas,
    )

    db = _db()
    try:
        org = _criar_org(db)
        ev = _criar_evento(db, org.id)
        ev.asaas_wallet_id = "wallet-test"
        ev.lista_espera_habilitada = False
        db.commit()
        ing = Ingresso(
            evento_id=ev.id,
            usuario_id=org.id,
            participante_email="buyer@ex.com",
            valor=50.0,
            status="pendente",
            asaas_payment_id="pay_existente",
            reservado_ate=datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(minutes=30),
        )
        db.add(ing)
        db.commit()
        db.refresh(ing)

        with (
            patch("app.services.pagamentos_asaas_handlers.settings") as s,
            patch(
                "app.services.pagamentos_asaas_handlers.obter_cobranca",
                return_value={"status": "CONFIRMED", "id": "pay_existente", "billingType": "PIX"},
            ),
            patch(
                "app.services.pagamentos_asaas_handlers.processar_cobranca_confirmada_gateway",
                return_value=[],
            ),
            patch("app.services.pagamentos_asaas_handlers.cancelar_cobranca_pendente") as cancel_mock,
        ):
            s.ASAAS_PLATFORM_WALLET_ID = "wallet-platform"
            with pytest.raises(HTTPException) as exc:
                iniciar_cobranca_asaas(
                    db,
                    org,
                    AsaasCobrancaRequest(ingresso_id=ing.id, metodo="pix"),
                )
        assert exc.value.status_code == 409
        cancel_mock.assert_not_called()
        assert ing.asaas_payment_id == "pay_existente"
    finally:
        db.close()


def test_iniciar_cobranca_nova_409_se_pago_mas_nao_liberado():
    from unittest.mock import patch

    import pytest
    from fastapi import HTTPException

    from app.services.pagamentos_asaas_handlers import (
        AsaasCobrancaRequest,
        iniciar_cobranca_asaas,
    )

    db = _db()
    try:
        org = _criar_org(db)
        ev = _criar_evento(db, org.id)
        ev.asaas_wallet_id = "wallet-test"
        ev.lista_espera_habilitada = False
        db.commit()
        ing = Ingresso(
            evento_id=ev.id,
            usuario_id=org.id,
            participante_email="buyer@ex.com",
            valor=50.0,
            status="pendente",
            reservado_ate=datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(minutes=30),
        )
        db.add(ing)
        db.commit()
        db.refresh(ing)

        with (
            patch("app.services.pagamentos_asaas_handlers.settings") as s,
            patch(
                "app.services.pagamentos_asaas_handlers.garantir_customer_asaas",
                return_value="cus_x",
            ),
            patch(
                "app.services.pagamentos_asaas_handlers.criar_cobranca_asaas",
                return_value={"id": "pay_novo_card", "status": "CONFIRMED", "billingType": "CREDIT_CARD"},
            ),
            patch(
                "app.services.pagamentos_asaas_handlers.processar_cobranca_confirmada_gateway",
                return_value=[],
            ),
        ):
            s.ASAAS_PLATFORM_WALLET_ID = "wallet-platform"
            with pytest.raises(HTTPException) as exc:
                iniciar_cobranca_asaas(
                    db,
                    org,
                    AsaasCobrancaRequest(ingresso_id=ing.id, metodo="card"),
                )
        assert exc.value.status_code == 409
        assert ing.asaas_payment_id == "pay_novo_card"
        assert ing.status == "pendente"
    finally:
        db.close()


def test_marcar_espera_comprada_nao_notifica_proximo(monkeypatch):
    from app.services.lista_espera import inscrever_espera, marcar_espera_comprada

    db = _db()
    try:
        org = _criar_org(db)
        ev = _criar_evento(db, org.id)
        e1 = inscrever_espera(db, ev, email="primeiro@ex.com")
        e1.status = "notificado"
        e1.token_compra = f"tok-{uuid.uuid4().hex[:8]}"
        e1.token_expira_em = datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(hours=24)
        e2 = inscrever_espera(db, ev, email="segundo@ex.com")
        db.commit()

        emails: list[str] = []
        monkeypatch.setattr(
            "app.services.lista_espera.enqueue_email_simples",
            lambda dest, subj, html: emails.append(dest) or True,
        )

        marcar_espera_comprada(db, ev.id, "primeiro@ex.com")
        db.commit()

        db.refresh(e1)
        db.refresh(e2)
        assert e1.status == "comprado"
        assert e2.status == "aguardando"
        assert emails == []
    finally:
        db.close()


def test_liberar_vagas_quantidade_um_por_janela(monkeypatch):
    from app.services.lista_espera import inscrever_espera, liberar_vagas_apos_cancelamento

    db = _db()
    try:
        org = _criar_org(db)
        ev = _criar_evento(db, org.id)
        e1 = inscrever_espera(db, ev, email="primeiro@ex.com")
        e2 = inscrever_espera(db, ev, email="segundo@ex.com")
        e3 = inscrever_espera(db, ev, email="terceiro@ex.com")
        db.commit()

        emails: list[str] = []
        monkeypatch.setattr(
            "app.services.lista_espera.enqueue_email_simples",
            lambda dest, subj, html: emails.append(dest) or True,
        )

        n = liberar_vagas_apos_cancelamento(db, ev.id, 2)
        assert n == 1
        assert emails == ["primeiro@ex.com"]

        db.refresh(e1)
        db.refresh(e2)
        db.refresh(e3)
        assert e1.status == "notificado"
        assert e2.status == "aguardando"
        assert e3.status == "aguardando"
    finally:
        db.close()


def test_produtor_patch_persiste_com_slug_existente():
    from app.models import Usuario

    email = f"org_prod_{uuid.uuid4().hex[:8]}@test.com"
    reg = test_api.client.post(
        "/api/auth/registrar",
        json={"email": email, "nome": "Org Prod", "senha": "senha12345", "tipo": "organizador"},
    )
    assert reg.status_code == 200, reg.text
    token = reg.json()["access_token"]

    db = _db()
    try:
        u = db.query(Usuario).filter(Usuario.email == email).first()
        assert u is not None
        u.slug_publico = f"slug-{uuid.uuid4().hex[:8]}"
        db.commit()
        slug = u.slug_publico
    finally:
        db.close()

    patch = test_api.client.patch(
        "/api/produtor/meu-perfil",
        headers={"Authorization": f"Bearer {token}"},
        json={"bio": "Bio atualizada pelo patch"},
    )
    assert patch.status_code == 200, patch.text

    pub = test_api.client.get(f"/api/produtor/{slug}")
    assert pub.status_code == 200, pub.text
    assert pub.json()["bio"] == "Bio atualizada pelo patch"


def test_api_lista_interesse():
    db = _db()
    try:
        org = _criar_org(db)
        ev = _criar_evento(db, org.id)
        r = test_api.client.post(
            f"/api/listas/interesse/{ev.slug}",
            json={"email": "novo@exemplo.com", "nome": "Test"},
        )
        assert r.status_code == 200
        assert r.json()["ok"] is True
    finally:
        db.close()


def test_api_simuladores():
    r = test_api.client.get("/api/simuladores/simular", params={"preco": 50, "metodo": "pix"})
    assert r.status_code == 200
    data = r.json()
    assert data["preco_bruto"] == 50
    assert "aviso_legal" in data


def test_simuladores_coerencia_api():
    from app.services.tarifas_plataforma import TARIFA_PADRAO, taxa_ingresso
    from app.services.taxas_asaas_publicas import AVISO_LEGAL, calcular_taxa_asaas

    preco = 100.0
    r = test_api.client.get(
        "/api/simuladores/simular",
        params={"preco": preco, "metodo": "cartao_parcelado", "parcelas": 3},
    )
    assert r.status_code == 200
    data = r.json()
    taxa_plat = taxa_ingresso(preco, TARIFA_PADRAO)
    taxa_asaas = calcular_taxa_asaas(preco, "cartao_parcelado", parcelas=3)
    liquido = round(max(0.0, preco - taxa_plat - taxa_asaas), 2)
    assert data["taxa_eventosbr"] == round(taxa_plat, 2)
    assert data["taxa_asaas_estimada"] == taxa_asaas
    assert data["liquido_organizador"] == liquido
    assert data["aviso_legal"] == AVISO_LEGAL
    assert data["parcelamento"]["parcelas"] == 3


def test_notificar_abertura_vendas_ao_publicar(monkeypatch):
    sent: list[str] = []

    def _enqueue(email: str, _assunto: str, _corpo: str) -> bool:
        sent.append(email)
        return True

    monkeypatch.setattr("app.services.lista_interesse.enqueue_email_simples", _enqueue)

    from app.services.lista_interesse import deve_notificar_abertura, notificar_abertura_vendas

    db = _db()
    try:
        org = _criar_org(db)
        ev = _criar_evento(db, org.id)
        ev.publicado = False
        db.commit()
        db.refresh(ev)
        inscrever_interesse(db, ev, email="a@ex.com", nome="A")
        inscrever_interesse(db, ev, email="b@ex.com", nome="B")
        ev.publicado = True
        assert deve_notificar_abertura(ev, era_publicado=False)
        n = notificar_abertura_vendas(db, ev)
        assert n == 2
        assert set(sent) == {"a@ex.com", "b@ex.com"}
    finally:
        db.close()


def test_parcelamento_config_persiste():
    email = f"org_parc_{uuid.uuid4().hex[:8]}@test.com"
    reg = test_api.client.post(
        "/api/auth/registrar",
        json={"email": email, "nome": "Org Parc", "senha": "senha12345", "tipo": "organizador"},
    )
    assert reg.status_code == 200
    token = reg.json()["access_token"]
    criar = test_api.client.post(
        "/api/eventos/criar",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "nome": "Show Parcelado",
            "descricao": "desc",
            "data_inicio": "2026-12-01T10:00:00",
            "data_fim": "2026-12-01T22:00:00",
            "local": "SP",
            "preco_ingresso": 80,
            "categoria": "Música",
            "publicado": True,
            "ingresso_lotes": [{"nome": "Geral", "preco": 80, "ordem": 1, "ativo": True}],
        },
    )
    assert criar.status_code == 200
    ev = criar.json()
    patch = test_api.client.patch(
        f"/api/eventos/id/{ev['id']}",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "nome": ev["nome"],
            "descricao": ev["descricao"],
            "data_inicio": ev["data_inicio"],
            "data_fim": ev["data_fim"],
            "local": ev["local"],
            "preco_ingresso": 80,
            "categoria": ev["categoria"],
            "publicado": True,
            "parcelamento_habilitado": True,
            "parcelamento_max": 6,
        },
    )
    assert patch.status_code == 200, patch.text
    body = patch.json()
    assert body["parcelamento_habilitado"] is True
    assert body["parcelamento_max"] == 6


def test_parcelamento_cobranca_installment_count():
    from unittest.mock import patch

    WALLET_ORG = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee"
    WALLET_PLATFORM = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"
    suf = uuid.uuid4().hex[:8]

    org_reg = test_api.client.post(
        "/api/auth/registrar",
        json={
            "email": f"org_inst_{suf}@test.com",
            "nome": "Org Inst",
            "senha": "senha12345",
            "tipo": "organizador",
        },
    )
    org_token = org_reg.json()["access_token"]
    db = _db()
    try:
        org_user = db.query(Usuario).filter(Usuario.email == f"org_inst_{suf}@test.com").first()
        assert org_user is not None
        org_user.asaas_wallet_id = WALLET_ORG
        db.commit()
    finally:
        db.close()

    ev_resp = test_api.client.post(
        "/api/eventos/criar",
        headers={"Authorization": f"Bearer {org_token}"},
        json={
            "nome": f"Parc {suf}",
            "descricao": "d",
            "data_inicio": "2026-12-01T10:00:00",
            "data_fim": "2026-12-01T22:00:00",
            "local": "SP",
            "preco_ingresso": 120,
            "categoria": "Música",
            "publicado": True,
            "parcelamento_habilitado": True,
            "parcelamento_max": 3,
            "ingresso_lotes": [{"nome": "Geral", "preco": 120, "ordem": 1, "ativo": True}],
        },
    )
    assert ev_resp.status_code == 200
    ev = ev_resp.json()

    cli_reg = test_api.client.post(
        "/api/auth/registrar",
        json={
            "email": f"cli_inst_{suf}@test.com",
            "nome": "Cli",
            "senha": "senha12345",
            "tipo": "cliente",
        },
    )
    cli_token = cli_reg.json()["access_token"]

    with patch("app.routes.pagamentos.settings") as route_settings:
        route_settings.payments_disabled = False
        route_settings.use_asaas = True
        route_settings.ASAAS_PLATFORM_WALLET_ID = WALLET_PLATFORM
        criar = test_api.client.post(
            "/api/pagamentos/criar",
            headers={"Authorization": f"Bearer {cli_token}"},
            json={
                "evento_id": ev["id"],
                "valor_centavos": 12000,
                "participante_nome": "Comprador",
                "participante_email": f"cli_inst_{suf}@test.com",
                "participante_cpf": "52998224725",
                "participante_telefone": "11987654321",
                "termo_compra_aceito": True,
            },
        )
    assert criar.status_code == 200
    iid = criar.json()["ingresso_id"]

    mock_payment = {"id": f"pay_{suf}", "status": "PENDING", "billingType": "CREDIT_CARD"}
    captured: dict = {}

    def _criar(**kwargs):
        captured.update(kwargs)
        return mock_payment

    with (
        patch("app.routes.pagamentos.settings") as route_settings,
        patch("app.services.pagamentos_asaas_handlers.settings") as svc_settings,
        patch("app.services.pagamentos_asaas_handlers.garantir_customer_asaas", return_value="cus_x"),
        patch("app.services.pagamentos_asaas_handlers.criar_cobranca_asaas", side_effect=_criar),
    ):
        route_settings.use_asaas = True
        svc_settings.ASAAS_PLATFORM_WALLET_ID = WALLET_PLATFORM
        cob = test_api.client.post(
            "/api/pagamentos/asaas/cobranca",
            headers={"Authorization": f"Bearer {cli_token}"},
            json={"ingresso_id": iid, "metodo": "card", "parcelas": 3},
        )
    assert cob.status_code == 200, cob.text
    assert captured.get("installment_count") == 3


def test_deve_notificar_abertura_quando_lote_abre():
    from app.services.lista_interesse import deve_notificar_abertura

    ev = Evento(
        nome="Show",
        descricao="d",
        data_inicio=datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(days=7),
        data_fim=datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(days=7, hours=3),
        local="SP",
        preco_ingresso=50.0,
        organizador_id="x",
        slug="show-x",
        publicado=True,
        aceita_interesse=True,
    )
    assert not deve_notificar_abertura(
        ev, era_publicado=True, tinha_venda_aberta=False, tem_venda_aberta=False
    )
    assert deve_notificar_abertura(
        ev, era_publicado=True, tinha_venda_aberta=False, tem_venda_aberta=True
    )
    assert not deve_notificar_abertura(
        ev, era_publicado=True, tinha_venda_aberta=True, tem_venda_aberta=True
    )


def test_notificar_interesse_escapa_html(monkeypatch):
    sent: list[tuple[str, str, str]] = []

    def _cap(email: str, assunto: str, corpo: str) -> bool:
        sent.append((email, assunto, corpo))
        return True

    monkeypatch.setattr("app.services.lista_interesse.enqueue_email_simples", _cap)

    from app.services.lista_interesse import notificar_abertura_vendas

    db = _db()
    try:
        org = _criar_org(db)
        ev = _criar_evento(db, org.id, nome="<script>alert(1)</script>")
        ev.publicado = True
        inscrever_interesse(db, ev, email="teste@ex.com")
        notificar_abertura_vendas(db, ev)
        assert sent
        assert "<script>" not in sent[0][2]
        assert "&lt;script&gt;" in sent[0][2]
    finally:
        db.close()


def test_produtor_rejeita_url_javascript():
    email = f"org_js_{uuid.uuid4().hex[:8]}@test.com"
    reg = test_api.client.post(
        "/api/auth/registrar",
        json={"email": email, "nome": "Org", "senha": "senha12345", "tipo": "organizador"},
    )
    token = reg.json()["access_token"]
    patch = test_api.client.patch(
        "/api/produtor/meu-perfil",
        headers={"Authorization": f"Bearer {token}"},
        json={"social_instagram": "javascript:alert(1)"},
    )
    assert patch.status_code == 422


def test_pagamento_rejeita_valor_abaixo_minimo_asaas():
    from unittest.mock import patch

    suf = uuid.uuid4().hex[:8]
    org_reg = test_api.client.post(
        "/api/auth/registrar",
        json={
            "email": f"org_min_{suf}@test.com",
            "nome": "Org",
            "senha": "senha12345",
            "tipo": "organizador",
        },
    )
    org_token = org_reg.json()["access_token"]
    ev_resp = test_api.client.post(
        "/api/eventos/criar",
        headers={"Authorization": f"Bearer {org_token}"},
        json={
            "nome": f"Barato {suf}",
            "descricao": "d",
            "data_inicio": "2026-12-01T10:00:00",
            "data_fim": "2026-12-01T22:00:00",
            "local": "SP",
            "preco_ingresso": 3,
            "categoria": "Outros",
            "publicado": True,
            "ingresso_lotes": [{"nome": "Geral", "preco": 3, "ordem": 1, "ativo": True}],
        },
    )
    assert ev_resp.status_code == 200
    ev = ev_resp.json()
    cli_reg = test_api.client.post(
        "/api/auth/registrar",
        json={
            "email": f"cli_min_{suf}@test.com",
            "nome": "Cli",
            "senha": "senha12345",
            "tipo": "cliente",
        },
    )
    cli_token = cli_reg.json()["access_token"]
    with patch("app.routes.pagamentos.settings") as route_settings:
        route_settings.payments_disabled = False
        route_settings.use_asaas = True
        criar = test_api.client.post(
            "/api/pagamentos/criar",
            headers={"Authorization": f"Bearer {cli_token}"},
            json={
                "evento_id": ev["id"],
                "valor_centavos": 300,
                "participante_nome": "Comprador",
                "participante_email": f"cli_min_{suf}@test.com",
                "participante_cpf": "52998224725",
                "participante_telefone": "11987654321",
                "termo_compra_aceito": True,
            },
        )
    assert criar.status_code == 400
    assert "5" in criar.json()["detail"]
