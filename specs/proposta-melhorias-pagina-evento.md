# Proposta: página pública do evento — mercado + modelo EventosBR

**Data:** 29/07/2026  
**Status:** ✅ Fases A + B implementadas (v1.17 / P17) — Fase C/D aguardando  
**Spec principal:** `specs/eventosbr-producao.md` §4 P17

---

## 1. Diagnóstico (antes)

Data, local e preço apareciam 3–5 vezes (hero → resumo → Sobre → checkout → sticky → mapa).
Urgência e reembolso também duplicavam.

## 2. Referências de mercado

Diversos Ingressos, AppTicket, Guichê Web, Uticket, PagTickets, G-ticket, Sympla,
Catraca Virtual, Ingresse, Ingresso Evento — ver histórico desta proposta.

**Padrão adotado:** meta uma vez + zona de compra sticky como única fonte de
preço/lote/CTA (estilo Diversos/Sympla). Não copiar white-label B2B na página do
comprador.

## 3. Modelo implementado (A + B)

| Zona | Conteúdo |
|------|----------|
| Hero / Meta única | Título, categoria, **Quando** + **Onde** (âncora `#mapa`), CTA, WhatsApp / copiar / mais |
| Comprar (sticky `lg:top-24`) | Preço, lote, reembolso curto, prova social, barra do lote, urgência, checkout |
| Sobre | **Só descrição** |
| Mapa `#mapa` | Endereço completo + embed |
| Confiança | Sem repetir reembolso |
| Sticky mobile | CTA + preço |

### Arquivos

- `evento-hero-banner.tsx` — sem preço; meta + share
- `evento-meta-unica.tsx` — fallback sem imagem
- `evento-compartilhar.tsx` — WhatsApp, copiar, Web Share
- `evento-public-client.tsx` — orquestra A+B
- `comprar-ingresso.tsx` — prova social + progresso do lote; urgência só aqui
- `evento-politica-reembolso.tsx` — linha curta
- `compra-info-confianca.tsx` — sem card de reembolso duplicado
- `evento-mapa-local.tsx` — `id="mapa"`
- **Removido:** `evento-resumo-rapido.tsx`

## 4. Fases

| Fase | Escopo | Status |
|------|--------|--------|
| **A** | Anti-repetição | ✅ |
| **B** | Prova social, restante do lote, WhatsApp/copiar | ✅ |
| **C** | FAQ, galeria, campos práticos (idade/portões) | 📋 Pendente |
| **D** | Assentos, upsell, tema visual por evento | 📋 Depois |

## 5. Critérios de review (A+B)

- [x] Data/local não repetem no Sobre nem em resumo separado
- [x] Preço não aparece no hero
- [x] Urgência só na zona de compra
- [x] Reembolso uma vez (compra)
- [x] Local do hero/meta linka para `#mapa`
- [x] Compartilhar WhatsApp + copiar link
- [x] Sticky compra no desktop; barra mobile com CTA+preço
- [x] Spec principal atualizada (P17 / v1.17)
