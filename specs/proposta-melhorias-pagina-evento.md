# Proposta: página pública do evento — mercado + modelo EventosBR

**Data:** 29/07/2026  
**Status:** 📋 Proposta para aprovação — **nada de UI/código nesta etapa**  
**Motivo:** informação repetitiva na página do evento + oportunidade de converter melhor (comprador)

---

## 1. Diagnóstico do EventosBR hoje

Rota: `/eventos/[slug]` (`evento-public-client.tsx` + componentes).

### Ordem atual (publicado)

1. Breadcrumb + voltar  
2. Hero (título + data + local + preço + CTAs)  
3. Resumo rápido (Data / Local / Preço / Lote + pills de lotes)  
4. Badge de urgência (opcional)  
5. Coluna dupla: **Comprar** | **Sobre** (nome + Início + Local + Ingresso + lista de lotes + descrição)  
6. Mapa (endereço de novo)  
7. Bloco de confiança (reembolso, etc.)  
8. Relacionados  
9. Barra sticky mobile (preço + CTA)

### Onde a informação se repete (problema observado)

| Dado | Aparece em |
|------|------------|
| Nome | breadcrumb, hero, Sobre, checkout |
| Data/início | hero, resumo, Sobre |
| Local | hero, resumo, Sobre, mapa |
| Preço | hero, resumo, Sobre, checkout, sticky |
| Lotes | resumo (pills), Sobre (lista), checkout (seletor) |
| Urgência | faixa acima do grid **e** dentro do checkout |
| Reembolso 10 dias | política no checkout **e** bloco de confiança |

**Efeito:** a página “explica o evento” três vezes antes de vender. No mobile isso empurra a compra para baixo; no desktop compete com o CTA. Concorrentes bons separam **contexto (uma vez)** de **compra (sempre à mão)**.

---

## 2. As 10 referências analisadas

| # | Empresa | Tipo | O que importa na página de venda |
|---|---------|------|----------------------------------|
| 1 | **Diversos Ingressos** | Marketplace B2C | Página de evento limpa: título + local **uma vez**, “Conheça mais”, tipos/valores, **galeria**, mapa, **FAQ**, CTA “Comprar agora” recorrente |
| 2 | **AppTicket** | Plataforma + vitrine | Descoberta por categoria/cidade; prova social de escala (“22 mil produtores”); eventos como cards claros (data/local/preço no card, não no texto) |
| 3 | **Guichê Web** | Marketplace | Foco em **cidade / perto de você**; listagem densa; página de evento tradicional estilo bilheteria (compra no centro da atenção) |
| 4 | **Uticket** | Plataforma produtor | Posicionamento em **repasse rápido** + recuperação de carrinho + influencers — na UX de venda: checkout rápido, virada de lote, WhatsApp |
| 5 | **PagTickets** | White-label | Página de vendas **com identidade do evento**; lotes/regras na zona de compra; mesas/assentos; promoters — reforça “a página veste o evento” |
| 6 | **G-ticket** | White-label / B2B | Site completo com marca; mapa de assentos; fila virtual — modelo enterprise, mas a lição é: **uma marca visual forte + compra sem ruído** |
| 7 | **Sympla** | Líder BR | Padrão-ouro: capa forte, meta (quando/onde) perto do título **uma vez**, descrição rica, tipos de ingresso claros, virada de lote, compartilhar, widgets |
| 8 | **Catraca Virtual** | Marketplace regional | Descoberta simples (“perto de você”); página de evento objetiva — data, local, comprar |
| 9 | **Ingresse** | Shows/festivais | Visual imersivo, urgência de lote, pouco texto burocrático na dobra |
| 10 | **Ingresso Evento** / mercado DIY | Plataformas novas | Página pronta em minutos: capa + ingressos + pagamento; check-in QR — reforça que o comprador quer **poucos campos e CTA óbvio** |

> Sites 1–6 = lista que você passou. 7–10 = líderes / pares de nicho para fechar 10 referências.

### Padrões que se repetem nos melhores

1. **Uma ficha técnica** (quando / onde) — não três.  
2. **Zona de compra sticky** (desktop: coluna; mobile: barra) = única fonte de preço/lote/CTA.  
3. **Descrição = storytelling**, sem repetir data/local/preço.  
4. **Prova social** (galeria, “X pessoas”, depoimentos) perto da decisão.  
5. **Urgência real** (lote atual, restante, virada) na zona de compra — não espalhada.  
6. **FAQ curto** (portão, idade, meia, onde está o ingresso).  
7. **Compartilhar** fácil (WhatsApp / copiar link).  
8. **Identidade do evento** (capa dominante), não só da plataforma.

### O que o EventosBR já tem a favor

- Hero com CTA + compartilhar nativo (base boa).  
- Lotes, urgência no modelo, lista de interesse/espera.  
- Reembolso / confiança (bom diferencial — só não duplicar).  
- Mapa + relacionados.  
- Split/repasse (diferencial de **produtor**; na página do **comprador** deve aparecer só como confiança leve, não como texto de painel).

---

## 3. Modelo proposto de página (arquitetura de informação)

### Princípio

> **Cada fato aparece uma vez no fluxo de leitura.**  
> **Preço, lote e CTA vivem só na zona de compra** (coluna + sticky).

### Wireframe alvo (desktop)

```
┌──────────────────────────────────────────────┬─────────────────────┐
│ HERO (imagem dominante + título + categoria) │                     │
│ Meta única: 📅 data · 📍 local (link p/ mapa) │   COMPRAR (sticky)   │
│ [Compartilhar]                               │   preço / lote       │
│                                              │   qtd / CTA          │
│ SOBRE — só descrição / programação           │   urgência (1x)      │
│ INFORMAÇÕES PRÁTICAS — idade, portão, etc.   │   reembolso curto    │
│ MAPA                                         │                     │
│ FAQ (opcional)                               │                     │
│ CONFIANÇA (1 bloco, sem repetir reembolso)   │                     │
│ RELACIONADOS                                 │                     │
└──────────────────────────────────────────────┴─────────────────────┘
         mobile: mesma ordem; compra sobe após hero; barra sticky embaixo
```

### O que some / muda (anti-repetição)

| Remover ou fundir | Motivo |
|-------------------|--------|
| `EventoResumoRapido` como bloco separado **ou** o `dl` Início/Local/Ingresso do Sobre | Hoje os dois dizem a mesma coisa que o hero |
| Lista de lotes no Sobre | Lote detalhado só no checkout |
| Preço no hero **e** no resumo **e** no Sobre | Preço só na zona de compra (+ sticky) |
| Urgência em dois lugares | Só na zona de compra |
| Reembolso duplicado | Uma linha no checkout **ou** no bloco confiança — não nos dois |

### O que entra (para atrair / converter)

| Item | Por quê (mercado) | Esforço |
|------|-------------------|---------|
| Meta única sob o título (data + local → âncora `#mapa`) | Sympla / Diversos | Baixo |
| Coluna comprar = única fonte de verdade | Todos | Baixo–médio |
| “X pessoas já garantiram lugar” (vendas reais) | Prova social | Baixo |
| Barra/contador de lote (“restam N”) se houver estoque | Urgência real | Baixo–médio |
| Compartilhar WhatsApp + copiar link (explícito) | Alcance orgânico | Baixo |
| FAQ do evento (campos ou texto estruturado) | Diversos | Médio |
| Campos práticos: classificação, abertura de portões, o que levar | Ficha escaneável | Médio (cadastro + UI) |
| Galeria de edições anteriores (opcional) | Diversos / prova social | Médio–alto |

### O que **não** fazer agora

- Upsell/loja tipo Sympla Store  
- Mapa de assentos / mesas (PagTickets/G-ticket) — outro `/spec`  
- White-label visual completo por evento (cores custom) — depois do core de conversão  
- Copiar landing B2B (Uticket/PagTickets “fale com especialista”) na página do **comprador**

---

## 4. Plano de execução (fases)

### Fase A — Limpeza (rápido, alto impacto na “repetição”)

1. Definir **uma** ficha meta (data + local) sob o título.  
2. Remover duplicatas: resumo **ou** Sobre-meta (não os dois).  
3. Preço/lotes/urgência **só** na zona de compra + sticky.  
4. Reembolso uma vez.  
5. Mapa: endereço completo só ali; no topo, local curto + “Ver no mapa”.

**Critério de pronto:** na primeira dobra mobile, o usuário vê título + meta + caminho claro para comprar, sem ler o mesmo local 3×.

### Fase B — Conversão (dados que já temos)

1. Prova social “X pessoas…” perto do CTA.  
2. Restante / progresso do lote atual (se `capacidade`/`vendidos` disponíveis).  
3. Compartilhar WhatsApp + copiar link (além do Web Share).  
4. Badge de urgência só no checkout.

### Fase C — Conteúdo que atrai (cadastro do organizador)

1. Campos opcionais: classificação etária, abertura de portões, dress code / o que levar.  
2. Bloco “Informações práticas” com ícones.  
3. FAQ (3–5 perguntas) editável no evento.  
4. Galeria opcional (3–6 fotos).

### Fase D — Depois (fora deste ciclo)

- Indicação/cupom por compartilhamento  
- Upsell  
- Assentos/mesas  
- Temas visuais por evento

---

## 5. Critérios de sucesso

- Menos scroll até o CTA no mobile (medir qualitativamente + heatmap se houver).  
- Zero repetição de data/local/preço fora da zona de compra (revisão manual).  
- Organizador consegue preencher ficha prática sem depender só da descrição livre.  
- Não regressar compra, lista de espera, interesse, mapa, SEO (JSON-LD).

---

## 6. Pedido de decisão

Sugestão: **aprovar Fase A + B** como próximo `/build` (sem campos novos de cadastro).  
Fase C em `/spec` próprio depois.

**Perguntas para você:**

1. Prefere manter o hero atual (card split) ou ir para capa mais dominante (estilo Sympla/Diversos)?  
2. No mobile, compra **logo após o hero** (como agora) ou só sticky + “Comprar” no hero?  
3. Quer FAQ e galeria já no primeiro ciclo, ou só A+B?

---

**Aguardando aprovação para transformar em `/spec` executável e depois `/build`.**
