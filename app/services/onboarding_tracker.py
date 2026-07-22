"""Acompanhamento dinâmico de conta de recebimento e assinatura."""

from __future__ import annotations

import json
import logging
from typing import Any

from sqlalchemy.orm import Session

from app.models import Usuario
from app.services.evento_repasse import repasse_status_aprovado
from app.services.onboarding_email import (
    enviar_email_assinatura_contratada,
    enviar_email_assinatura_falhou,
    enviar_email_conta_aprovada,
    enviar_email_conta_reprovada,
)
from app.services.organizador_asaas import (
    acompanhamento_repasse_organizador,
    atualizar_status_repasse_organizador,
)

logger = logging.getLogger(__name__)

def _steps_conta(status: str) -> list[dict[str, str]]:
    final_label = "Conta não criada" if status == "REJECTED" else "Conta criada"
    final_key = "REJECTED" if status == "REJECTED" else "APPROVED"
    return [
        {"key": "SUBMITTED", "label": "Informações enviadas"},
        {"key": "IN_REVIEW", "label": "Em análise"},
        {"key": final_key, "label": final_label},
    ]

def _steps_assinatura(status: str) -> list[dict[str, str]]:
    final_label = "Assinatura não contratada" if status == "PAYMENT_FAILED" else "Assinatura contratada"
    final_key = "PAYMENT_FAILED" if status == "PAYMENT_FAILED" else "SUBSCRIBED"
    return [
        {"key": "PAYMENT_PROCESSING", "label": "Processando pagamento"},
        {"key": final_key, "label": final_label},
    ]


def tracking_id_conta(usuario: Usuario) -> str:
    aid = (usuario.asaas_account_id or "").strip()
    if aid:
        return aid
    return f"org-{usuario.id}"


def _resolver_usuario_conta(db: Session, usuario: Usuario, tracking_id: str) -> Usuario | None:
    tid = (tracking_id or "").strip()
    if not tid:
        return None
    if tid == tracking_id_conta(usuario):
        return usuario
    if tid.startswith("org-") and tid[4:] == usuario.id:
        return usuario
    if tid == (usuario.asaas_account_id or "").strip() and usuario.id:
        return usuario
    return None


def _status_conta_tracker(repasse_status: str | None) -> str:
    s = (repasse_status or "").strip().lower()
    if s == "approved":
        return "APPROVED"
    if s == "rejected":
        return "REJECTED"
    if s == "awaiting_approval":
        return "IN_REVIEW"
    if s in ("pending", "linked", "manual"):
        return "SUBMITTED" if s == "pending" else "APPROVED"
    return "SUBMITTED"


def _motivos_reprovacao_conta(detalhes: dict[str, Any] | None) -> list[str]:
    if not detalhes:
        return ["Não foi possível validar os dados enviados. Revise as informações e tente novamente."]
    rotulos = {
        "commercialInfo": "Dados comerciais",
        "documentation": "Documentação",
        "bankAccountInfo": "Conta bancária",
        "general": "Aprovação geral",
    }
    motivos: list[str] = []
    for chave, rotulo in rotulos.items():
        valor = detalhes.get(chave)
        if not valor:
            continue
        texto = str(valor).strip()
        if texto.upper() in ("APPROVED", "OK"):
            continue
        motivos.append(f"{rotulo}: {texto}")
    return motivos or ["Não foi possível validar os dados enviados. Revise as informações e tente novamente."]


def _payload_tracker_conta(
    usuario: Usuario,
    *,
    detalhes: dict[str, Any] | None = None,
) -> dict[str, Any]:
    status = _status_conta_tracker(usuario.asaas_repasse_status)
    final = status in ("APPROVED", "REJECTED")
    reasons = _motivos_reprovacao_conta(detalhes) if status == "REJECTED" else []
    titulo = None
    mensagem = None
    final_state = None
    if status == "APPROVED":
        final_state = "success"
        titulo = "Conta criada com sucesso"
        mensagem = "Sua conta de recebimento foi aprovada. Você já pode publicar eventos pagos."
    elif status == "REJECTED":
        final_state = "error"
        titulo = "Não foi possível criar sua conta"
        mensagem = "Revise os motivos abaixo e reenvie os dados para uma nova análise."
    return {
        "tracking_id": tracking_id_conta(usuario),
        "status": status,
        "reasons": reasons,
        "final": final,
        "final_state": final_state,
        "titulo_final": titulo,
        "mensagem_final": mensagem,
        "steps": _steps_conta(status),
        "current_step": status,
        "repasse_aprovado": repasse_status_aprovado(usuario.asaas_repasse_status),
        "pode_reenviar_conta": status == "REJECTED",
    }


def notificar_transicao_conta(
    db: Session,
    usuario: Usuario,
    *,
    status_anterior: str | None,
    detalhes: dict[str, Any] | None = None,
) -> None:
    status = _status_conta_tracker(usuario.asaas_repasse_status)
    antes = _status_conta_tracker(status_anterior)
    if status == antes:
        return
    tid = tracking_id_conta(usuario)
    if status == "APPROVED":
        enviar_email_conta_aprovada(usuario, tracking_id=tid)
    elif status == "REJECTED":
        enviar_email_conta_reprovada(
            usuario,
            motivos=_motivos_reprovacao_conta(detalhes),
            tracking_id=tid,
        )
    db.add(usuario)


def status_onboarding_conta(
    db: Session,
    usuario: Usuario,
    *,
    tracking_id: str,
) -> dict[str, Any]:
    if not _resolver_usuario_conta(db, usuario, tracking_id):
        raise ValueError("Acompanhamento não encontrado para este organizador.")
    if not (usuario.asaas_account_id or "").strip() and not tracking_id.startswith("org-"):
        raise ValueError("Ainda não há solicitação de conta de recebimento.")
    usuario = atualizar_status_repasse_organizador(db, usuario)
    db.commit()
    db.refresh(usuario)
    detalhes = None
    if usuario.asaas_repasse_detalhes:
        try:
            detalhes = json.loads(usuario.asaas_repasse_detalhes)
        except json.JSONDecodeError:
            detalhes = None
    return _payload_tracker_conta(usuario, detalhes=detalhes)


def acompanhamento_conta_completo(db: Session, usuario: Usuario) -> dict[str, Any]:
    base = acompanhamento_repasse_organizador(db, usuario)
    detalhes = base.get("detalhes") if isinstance(base.get("detalhes"), dict) else None
    tracker = _payload_tracker_conta(usuario, detalhes=detalhes)
    return {**base, **tracker}


def _resolver_usuario_assinatura(db: Session, usuario: Usuario, subscription_id: str) -> bool:
    sid = (subscription_id or "").strip()
    if not sid:
        return False
    renovacao = (usuario.assinatura_renovacao_payment_id or "").strip()
    ultimo = (usuario.assinatura_ultimo_payment_id or "").strip()
    return sid in {renovacao, ultimo}


def _status_assinatura_tracker(usuario: Usuario) -> str:
    from app.services.assinatura_organizador import status_assinatura

    snap = status_assinatura(usuario)
    if snap.get("assinatura_ativa"):
        return "SUBSCRIBED"
    tracker = (getattr(usuario, "assinatura_tracker_status", None) or "").strip()
    if tracker == "PAYMENT_FAILED":
        return "PAYMENT_FAILED"
    if snap.get("renovacao_pendente") or tracker == "PAYMENT_PROCESSING":
        return "PAYMENT_PROCESSING"
    return "PAYMENT_PROCESSING"


def _motivos_falha_assinatura(usuario: Usuario) -> list[str]:
    raw = getattr(usuario, "assinatura_tracker_falha_motivos", None) or ""
    if not raw:
        return ["Não foi possível confirmar o pagamento."]
    try:
        parsed = json.loads(raw)
        if isinstance(parsed, list) and parsed:
            return [str(x) for x in parsed if str(x).strip()]
    except json.JSONDecodeError:
        pass
    return [str(raw)]


def status_onboarding_assinatura(
    db: Session,
    usuario: Usuario,
    *,
    subscription_id: str,
) -> dict[str, Any]:
    if not _resolver_usuario_assinatura(db, usuario, subscription_id):
        raise ValueError("Assinatura não encontrada para este organizador.")

    from app.services.assinatura_organizador import sincronizar_assinatura_pendente

    if (usuario.assinatura_renovacao_payment_id or "").strip() == subscription_id.strip():
        sincronizar_assinatura_pendente(db, usuario)
        db.refresh(usuario)

    status = _status_assinatura_tracker(usuario)
    final = status in ("SUBSCRIBED", "PAYMENT_FAILED")
    titulo = None
    mensagem = None
    final_state = None
    reasons: list[str] = []
    if status == "SUBSCRIBED":
        final_state = "success"
        titulo = "Assinatura contratada com sucesso"
        mensagem = "Sua taxa reduzida por ingresso já está ativa."
    elif status == "PAYMENT_FAILED":
        final_state = "error"
        titulo = "Assinatura não contratada"
        mensagem = "Verifique seu e-mail para entender os motivos e tente novamente no Financeiro."
        reasons = []

    return {
        "subscription_id": subscription_id.strip(),
        "status": status,
        "reasons": reasons,
        "final": final,
        "final_state": final_state,
        "titulo_final": titulo,
        "mensagem_final": mensagem,
        "steps": _steps_assinatura(status),
        "current_step": status,
        "mostrar_motivos_na_tela": status != "PAYMENT_FAILED",
    }


def marcar_assinatura_processando(db: Session, usuario: Usuario) -> None:
    usuario.assinatura_tracker_status = "PAYMENT_PROCESSING"
    usuario.assinatura_tracker_falha_motivos = None
    db.add(usuario)


def notificar_assinatura_contratada(db: Session, usuario: Usuario) -> None:
    enviar_email_assinatura_contratada(usuario)
    db.add(usuario)


def notificar_assinatura_falhou(
    db: Session,
    usuario: Usuario,
    *,
    motivos: list[str],
) -> None:
    enviar_email_assinatura_falhou(usuario, motivos=motivos)
    db.add(usuario)


def motivos_falha_pagamento_assinatura(payment: dict, *, event_type: str | None = None) -> list[str]:
    status = str(payment.get("status") or "").strip().upper()
    if status == "OVERDUE":
        return ["Pagamento PIX expirado ou não identificado no prazo."]
    if status in ("DELETED", "CANCELLED"):
        return ["Cobrança cancelada antes da confirmação do pagamento."]
    if event_type and "REFUND" in event_type.upper():
        return ["Pagamento estornado ou contestado."]
    msg = str(payment.get("failReasonDescription") or payment.get("description") or "").strip()
    if msg:
        return [msg]
    return ["Pagamento não confirmado pelo processador."]
