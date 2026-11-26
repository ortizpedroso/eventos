"""Link do nome do organizador na página do evento: domínio próprio só quando ativo e liberado."""

from __future__ import annotations

from datetime import datetime, timedelta

from app.models import Usuario
from app.services.organizador_publico import pagina_publica_url

DOMINIO = "eventos.agencia.com.br"


def _org(**campos) -> Usuario:
    return Usuario(tipo="organizador", slug_publico="agencia", **campos)


def _liberado() -> dict:
    return {"whitelabel_cortesia_ate": datetime.now() + timedelta(days=30)}


def test_dominio_ativo_e_liberado_leva_para_o_dominio_proprio():
    org = _org(brand_custom_domain=DOMINIO, brand_custom_domain_ativo_em=datetime.now(), **_liberado())
    assert pagina_publica_url(org) == f"https://{DOMINIO}"


def test_dominio_ainda_nao_verificado_fica_na_plataforma():
    org = _org(brand_custom_domain=DOMINIO, brand_custom_domain_ativo_em=None, **_liberado())
    assert pagina_publica_url(org) == "/produtor/agencia"


def test_white_label_vencido_fica_na_plataforma():
    org = _org(
        brand_custom_domain=DOMINIO,
        brand_custom_domain_ativo_em=datetime.now(),
        whitelabel_cortesia_ate=datetime.now() - timedelta(days=60),
    )
    assert pagina_publica_url(org) == "/produtor/agencia"


def test_sem_slug_publico_nao_ha_link():
    assert pagina_publica_url(Usuario(tipo="organizador")) is None
