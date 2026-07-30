"""Carteirinha completa do ingresso (QR + nome/evento/data/local numa imagem só)."""

from __future__ import annotations

import io

from PIL import Image

from app.services.ingresso_qr import gerar_ticket_card_png_bytes


class TestCarteirinhaIngresso:
    def test_gera_png_valido(self):
        png = gerar_ticket_card_png_bytes(
            ingresso_id="ing-teste-1",
            evento_nome="Show da Banda XYZ",
            data_local_fmt="15/08/2026 às 20:00",
            local="Arena Fonte Nova, Salvador - BA",
            participante_nome="Maria Oliveira",
        )
        img = Image.open(io.BytesIO(png))
        assert img.format == "PNG"
        assert img.width == 480
        assert img.height > 400

    def test_nome_evento_curto_nao_gera_imagem_gigante(self):
        """Regressão: altura é calculada dinamicamente pelo nº de linhas do
        título — nomes curtos não devem deixar espaço em branco excessivo."""
        png_curto = gerar_ticket_card_png_bytes(
            ingresso_id="ing-teste-2",
            evento_nome="Festa Junina",
            data_local_fmt="20/06/2026 às 19:00",
            local="Praça Central",
            participante_nome="João",
        )
        png_longo = gerar_ticket_card_png_bytes(
            ingresso_id="ing-teste-3",
            evento_nome="Show da Banda XYZ ao Vivo — Edição Especial de Verão com Participação Convidada",
            data_local_fmt="15/08/2026 às 20:00",
            local="Arena Fonte Nova, Avenida Presidente Juscelino Kubitschek, Salvador - BA",
            participante_nome="Maria Oliveira Santos Almeida",
        )
        img_curto = Image.open(io.BytesIO(png_curto))
        img_longo = Image.open(io.BytesIO(png_longo))
        assert img_curto.height < img_longo.height

    def test_titulo_muito_longo_nao_quebra(self):
        """Título gigante não deve levantar exceção nem virar imagem absurda —
        trunca em 2 linhas (_quebrar_linhas já limita)."""
        png = gerar_ticket_card_png_bytes(
            ingresso_id="ing-teste-4",
            evento_nome="A" * 300,
            data_local_fmt="01/01/2027 às 10:00",
            local="B" * 300,
            participante_nome="Nome Teste",
        )
        img = Image.open(io.BytesIO(png))
        assert img.height < 1200
