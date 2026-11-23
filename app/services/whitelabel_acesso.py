"""Quem pode usar domínio próprio: assinante, cortesia do dono da plataforma ou tolerância."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime, time, timedelta, timezone
from typing import Literal

from app.models import Usuario

TOLERANCIA = timedelta(days=7)
BRASILIA = timezone(timedelta(hours=-3))

MotivoAcesso = Literal["assinatura", "cortesia", "tolerancia", "sem_plano"]


@dataclass(frozen=True)
class AcessoWhitelabel:
    motivo: MotivoAcesso
    ate: datetime | None

    @property
    def liberado(self) -> bool:
        return self.motivo != "sem_plano"

    def para_json(self) -> dict:
        return {
            "liberado": self.liberado,
            "motivo": self.motivo,
            "ate": self.ate.isoformat() if self.ate else None,
        }


def acesso_whitelabel(org: Usuario, agora: datetime | None = None) -> AcessoWhitelabel:
    agora = agora or datetime.now(timezone.utc).replace(tzinfo=None)
    assinatura = org.assinatura_valida_ate if org.plano_tarifa == "assinatura" else None
    cortesia = org.whitelabel_cortesia_ate

    vigentes = [
        (fim, motivo)
        for fim, motivo in ((assinatura, "assinatura"), (cortesia, "cortesia"))
        if fim is not None and fim >= agora
    ]
    if vigentes:
        fim, motivo = max(vigentes, key=lambda par: par[0])
        return AcessoWhitelabel(motivo=motivo, ate=fim)

    ultimo_fim = max((d for d in (org.assinatura_valida_ate, cortesia) if d is not None), default=None)
    if ultimo_fim is not None and ultimo_fim + TOLERANCIA >= agora:
        return AcessoWhitelabel(motivo="tolerancia", ate=ultimo_fim + TOLERANCIA)
    return AcessoWhitelabel(motivo="sem_plano", ate=None)


def fim_do_dia_brasilia(dia: date) -> datetime:
    """Cortesia vale até 23h59 do dia escolhido, no horário de Brasília (gravado em UTC)."""
    return datetime.combine(dia, time(23, 59, 59), tzinfo=BRASILIA).astimezone(timezone.utc).replace(tzinfo=None)


def dia_brasilia(momento: datetime) -> date:
    return momento.replace(tzinfo=timezone.utc).astimezone(BRASILIA).date()
