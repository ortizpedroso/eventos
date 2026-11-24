"""Domínio próprio configurado pelo organizador: cadastro e verificação do apontamento DNS."""

from __future__ import annotations

import socket
from dataclasses import dataclass
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.models import Usuario
from app.services.organizador_publico import _dominio_base_plataforma, validar_dominio_proprio
from app.services.whitelabel_acesso import acesso_whitelabel


class DominioIndisponivel(Exception):
    """O domínio não pode ser usado por este organizador; a mensagem vai para a tela."""


def enderecos_ip(host: str) -> frozenset[str]:
    try:
        return frozenset(info[4][0] for info in socket.getaddrinfo(host, 443, proto=socket.IPPROTO_TCP))
    except OSError:
        return frozenset()


@dataclass(frozen=True)
class Apontamento:
    dominio: str
    alvo_cname: str
    ips_plataforma: frozenset[str]
    ips_dominio: frozenset[str]

    @property
    def correto(self) -> bool:
        return bool(self.ips_dominio) and self.ips_dominio <= self.ips_plataforma

    def para_json(self) -> dict:
        return {
            "dominio": self.dominio,
            "correto": self.correto,
            "alvo_cname": self.alvo_cname,
            "ips_plataforma": sorted(self.ips_plataforma),
            "ips_encontrados": sorted(self.ips_dominio),
        }


def checar_apontamento(dominio: str) -> Apontamento:
    base = _dominio_base_plataforma() or "eventosbr.app.br"
    return Apontamento(
        dominio=dominio,
        alvo_cname=base,
        ips_plataforma=enderecos_ip(base),
        ips_dominio=enderecos_ip(dominio),
    )


def definir_dominio(db: Session, org: Usuario, valor: str | None) -> None:
    dominio = validar_dominio_proprio(valor)
    if dominio == org.brand_custom_domain:
        return
    if dominio:
        if not acesso_whitelabel(org).liberado:
            raise DominioIndisponivel("Domínio próprio faz parte do plano com mensalidade.")
        dono = db.query(Usuario).filter(Usuario.brand_custom_domain == dominio, Usuario.id != org.id).first()
        if dono:
            raise DominioIndisponivel("Este domínio já está em uso por outro organizador.")
    org.brand_custom_domain = dominio
    org.brand_custom_domain_ativo_em = None


def verificar_e_ativar(org: Usuario) -> Apontamento:
    if not org.brand_custom_domain:
        raise DominioIndisponivel("Cadastre um domínio antes de verificar.")
    apontamento = checar_apontamento(org.brand_custom_domain)
    if apontamento.correto and org.brand_custom_domain_ativo_em is None:
        org.brand_custom_domain_ativo_em = datetime.now(timezone.utc).replace(tzinfo=None)
    return apontamento
