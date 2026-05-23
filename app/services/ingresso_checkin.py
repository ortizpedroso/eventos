"""Códigos QR e validação de check-in."""

from __future__ import annotations

import hashlib
import hmac
import re
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.models import Evento, Ingresso, Usuario
from config.settings import CHECKIN_REQUIRE_SIGNED, settings

_PREFIX = "EBR1"
_UUID_RE = re.compile(
    r"[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}",
    re.I,
)


def _secret() -> bytes:
    key = (settings.SECRET_KEY or "").strip()
    if not key:
        if CHECKIN_REQUIRE_SIGNED:
            raise RuntimeError("SECRET_KEY é obrigatória para check-in assinado")
        key = "dev-insecure-checkin"
    return key.encode("utf-8")


def assinatura_ingresso(ingresso_id: str) -> str:
    return hmac.new(_secret(), ingresso_id.encode("utf-8"), hashlib.sha256).hexdigest()[:12]


def codigo_checkin(ingresso_id: str) -> str:
    return f"{_PREFIX}:{ingresso_id}:{assinatura_ingresso(ingresso_id)}"


def ingresso_qr_payload(ingresso_id: str) -> str:
    """Payload no QR (compatível com leitura manual e URL legada)."""
    return codigo_checkin(ingresso_id)


def extrair_ingresso_id(codigo: str) -> str | None:
    raw = (codigo or "").strip()
    if not raw:
        return None

    if raw.startswith(f"{_PREFIX}:"):
        parts = raw.split(":")
        if len(parts) >= 3:
            iid = parts[1].strip()
            sig = parts[2].strip()
            if iid and sig == assinatura_ingresso(iid):
                return iid
        return None

    if CHECKIN_REQUIRE_SIGNED:
        return None

    m = _UUID_RE.search(raw)
    if m:
        return m.group(0)

    try:
        from uuid import UUID

        UUID(raw)
        return raw
    except ValueError:
        return None


def realizar_checkin(
    db: Session,
    organizador: Usuario,
    codigo: str,
) -> dict:
    ingresso_id = extrair_ingresso_id(codigo)
    if not ingresso_id:
        raise ValueError("Código inválido ou ingresso não reconhecido.")

    # SELECT FOR UPDATE: evita dupla validação quando dois leitores de QR
    # scanneiam o mesmo ingresso simultaneamente em portarias com filas paralelas.
    ingresso = (
        db.query(Ingresso)
        .filter(Ingresso.id == ingresso_id)
        .with_for_update()
        .first()
    )
    if not ingresso:
        raise ValueError("Ingresso não encontrado.")

    evento = db.get(Evento, ingresso.evento_id)
    if not evento or evento.organizador_id != organizador.id:
        raise ValueError("Este ingresso não pertence aos seus eventos.")

    st = (ingresso.status or "").lower()
    if st == "usado":
        return {
            "ok": True,
            "ja_utilizado": True,
            "ingresso_id": ingresso.id,
            "participante_nome": ingresso.participante_nome,
            "evento_nome": evento.nome,
            "checkin_em": ingresso.checkin_em.isoformat() if ingresso.checkin_em else None,
            "mensagem": "Ingresso já validado na entrada.",
        }
    if st != "pago":
        raise ValueError(f"Ingresso com status «{st}» não pode entrar (aguardando pagamento ou cancelado).")

    agora = datetime.now(timezone.utc).replace(tzinfo=None)
    ingresso.status = "usado"
    ingresso.checkin_em = agora
    ingresso.checkin_por_id = organizador.id
    db.commit()
    db.refresh(ingresso)

    return {
        "ok": True,
        "ja_utilizado": False,
        "ingresso_id": ingresso.id,
        "participante_nome": ingresso.participante_nome,
        "evento_nome": evento.nome,
        "checkin_em": agora.isoformat(),
        "mensagem": "Check-in realizado com sucesso.",
    }


def realizar_checkin_portaria(
    db: Session,
    evento_id: str,
    codigo: str,
) -> dict:
    """Validação via link da portaria (sem login do colaborador)."""
    evento = db.get(Evento, evento_id)
    if not evento:
        raise ValueError("Evento não encontrado.")

    ingresso_id = extrair_ingresso_id(codigo)
    if not ingresso_id:
        raise ValueError("Código inválido ou ingresso não reconhecido.")

    # SELECT FOR UPDATE: evita dupla validação concorrente na portaria.
    ingresso = (
        db.query(Ingresso)
        .filter(Ingresso.id == ingresso_id)
        .with_for_update()
        .first()
    )
    if not ingresso:
        raise ValueError("Ingresso não encontrado.")

    if ingresso.evento_id != evento.id:
        raise ValueError("Este ingresso é de outro evento.")

    st = (ingresso.status or "").lower()
    if st == "usado":
        return {
            "ok": True,
            "ja_utilizado": True,
            "ingresso_id": ingresso.id,
            "participante_nome": ingresso.participante_nome,
            "evento_nome": evento.nome,
            "checkin_em": ingresso.checkin_em.isoformat() if ingresso.checkin_em else None,
            "mensagem": "Ingresso já validado na entrada.",
        }
    if st != "pago":
        raise ValueError(f"Ingresso com status «{st}» não pode entrar (aguardando pagamento ou cancelado).")

    agora = datetime.now(timezone.utc).replace(tzinfo=None)
    ingresso.status = "usado"
    ingresso.checkin_em = agora
    ingresso.checkin_por_id = evento.organizador_id
    db.commit()
    db.refresh(ingresso)

    return {
        "ok": True,
        "ja_utilizado": False,
        "ingresso_id": ingresso.id,
        "participante_nome": ingresso.participante_nome,
        "evento_nome": evento.nome,
        "checkin_em": agora.isoformat(),
        "mensagem": "Entrada liberada.",
    }
