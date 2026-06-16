"""Lotes: período de vendas e compra_disponivel na API."""

from datetime import datetime, timedelta, timezone

from tests.test_api import TestingSessionLocal, client

from app.models import Evento, EventoIngressoLote, Usuario


def _seed_evento_lote(*, vendas_fim: datetime | None) -> tuple[str, str]:
    db = TestingSessionLocal()
    org = Usuario(
        email=f"org.lote.{datetime.now().timestamp()}@test.com",
        nome="Org",
        senha_hash="x",
        tipo="organizador",
    )
    db.add(org)
    db.flush()
    slug = f"evento-lote-{org.id[:8]}"
    ev = Evento(
        slug=slug,
        organizador_id=org.id,
        nome="Evento Lote",
        descricao="Teste",
        data_inicio=datetime(2026, 6, 1, 10, 0),
        data_fim=datetime(2026, 6, 1, 12, 0),
        local="Local",
        preco_ingresso=50.0,
        categoria="Outros",
        publicado=True,
    )
    db.add(ev)
    db.flush()
    lote = EventoIngressoLote(
        evento_id=ev.id,
        nome="1º lote",
        preco=50.0,
        ordem=1,
        quantidade_maxima=100,
        ativo=True,
        vendas_inicio=None,
        vendas_fim=vendas_fim,
    )
    db.add(lote)
    db.commit()
    slug_out = ev.slug
    id_out = ev.id
    db.close()
    return slug_out, id_out


class TestCompraDisponivel:
    def test_lote_fora_do_periodo_bloqueia_compra(self):
        ontem = datetime.now(timezone.utc).replace(tzinfo=None) - timedelta(days=1)
        slug, _ = _seed_evento_lote(vendas_fim=ontem)
        r = client.get(f"/api/eventos/{slug}")
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["compra_disponivel"] is False
        assert body["lote_compra_id"] is None
        assert body["preco_compra"] is None
        assert "período de vendas" in (body.get("motivo_compra_indisponivel") or "").lower()
