# Proposta: página pública do evento — mercado + modelo EventosBR

**Data:** 29/07/2026
**Status:** ✅ Fases A + B implementadas (v1.17 / P17) — Fase C/D aguardando
**Spec principal:** `specs/eventosbr-producao.md` §4 P17

---

## 1. Diagnóstico (antes)

Data, local e preço apareciam 3–5 vezes (hero → resumo → Sobre → checkout → sticky → mapa).
Urgência e reembolso também duplicavam.

## 2. Modelo implementado (A + B)

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

## 3. Fases

| Fase | Escopo | Status |
|------|--------|--------|
| **A** | Anti-repetição | ✅ |
| **B** | Prova social, restante do lote, WhatsApp/copiar | ✅ |
| **C** | FAQ, galeria, campos práticos (idade/portões) | 📋 Pendente |
| **D** | Assentos, upsell, tema visual por evento | 📋 Depois |

## 4. Critérios de review (A+B)

- [x] Data/local não repetem no Sobre nem em resumo separado
- [x] Preço não aparece no hero
- [x] Urgência só na zona de compra
- [x] Reembolso uma vez (compra)
- [x] Local do hero/meta linka para `#mapa`
- [x] Compartilhar WhatsApp + copiar link
- [x] Sticky compra no desktop; barra mobile com CTA+preço
- [x] Spec principal atualizada (P17 / v1.17)

---

## 5. Pesquisa de mercado que fundamentou o modelo acima

Analisei diretamente 6 sites que você indicou (Diversos Ingressos, AppTicket, Guichê Web, Uticket, PagTickets, G-ticket) e percebi uma coisa importante: **a maioria deles NÃO é concorrente direto do jeito que a gente imaginava.**

- **AppTicket, PagTickets, G-ticket**: vendem **software B2B** — o cliente deles é o produtor de eventos (ou até "monte sua própria ticketeira white-label"), não o comprador final. O site institucional é uma landing page de vendas pra produtor, não uma vitrine de eventos pro público.
- **Diversos Ingressos, Uticket**: esses sim são mais parecidos com a gente — vitrine pro público comprar, mas com forte pegada regional/nichada (Diversos: teatro/dança/Goiás; Uticket: geral, mas com foco pesado em ferramentas de conversão).
- **Guichê Web**: o site carrega a lista de eventos via JavaScript — não consegui nem ver os eventos na primeira leitura, o que é um sinal de alerta de SEO/performance (Google também tem dificuldade com isso).

**Isso é uma boa notícia pra gente**: como somos uma vitrine B2C completa (não só um software pro produtor), temos menos concorrência direta "cara a cara" do que parecia — o principal concorrente de verdade continua sendo a Sympla.

## 1. Quem eu analisei (atualizado)

| Plataforma | Modelo | O que aprendi |
|---|---|---|
| **Sympla** | B2C (vitrine + software) | Líder — ver seção 2 |
| **Diversos Ingressos** | B2C nichado (teatro/dança/regional) | Depoimentos em vídeo/foto muito bem posicionados na home; "cases de sucesso" como páginas dedicadas (prova social forte); WhatsApp como canal principal de contato/suporte (nem formulário) |
| **Uticket** | B2C + ferramentas agressivas de conversão | **Repasse no mesmo dia** como diferencial nº1; recuperação de carrinho abandonado (+20% de vendas, alegam); rede de afiliados/influenciadores com link e cupom próprios; venda via WhatsApp com vendedores cadastrados |
| **AppTicket** | B2B (SaaS pro produtor) | Não é vitrine igual à nossa — foco total em "crie seu evento", números de autoridade (+12 mil produtores, +1 milhão de ingressos) |
| **Guichê Web** | B2C | Site depende de JS pra listar eventos (ponto fraco de SEO); "Fale conosco" abre direto um formulário pra iniciar conversa por WhatsApp |
| **PagTickets** | B2B (SaaS + white-label pra ticketeiras) | Não é vitrine — venda por assinatura mensal (R$97 produtor / R$247 ticketeira) + taxa; foco em recursos operacionais (PDV, mapa de assentos, portaria offline) |
| **G-ticket** | B2B (SaaS + POS físico) | Site institucional datado, foco em maquininha física e revenda white-label; menos relevante pro nosso caso |
| **Catraca Virtual / Even3 / Zig / Lets.events** | Referências gerais (1ª rodada) | Ver proposta original abaixo |
| **Ticketmaster / SeatGeek / StubHub** | Referência internacional | Padrão-ouro de UX (1ª rodada) |

⚠️ Eventbrite encerrou operações no Brasil em dezembro/2025 (achado da 1ª rodada, mantido).

## 2. Ideias novas que vieram dessa 2ª rodada (além da proposta original)

1. **Recuperação de carrinho abandonado** (Uticket) — se alguém inicia a compra e não finaliza, um e-mail/lembrete automático depois de um tempo. Já temos a infraestrutura de fila de e-mail confiável pronta; isso seria uma extensão natural.
2. **Repasse no mesmo dia como diferencial de marketing** (Uticket) — precisa confirmar com você se já é assim ou se é uma promessa que dá pra fazer; se sim, vale destacar isso na home/planos como diferencial forte (poucos comunicam isso tão bem quanto a Uticket).
3. **WhatsApp como canal principal de contato**, não só formulário (Diversos Ingressos, Guichê Web) — considerar adicionar um botão de WhatsApp visível ao lado do "Fale conosco", já que é claramente um padrão do mercado brasileiro.
4. **Páginas de "case de sucesso" por organizador** (Diversos Ingressos) — depoimento com nome + resultado, como conteúdo de marketing/SEO, não só na home.
5. **Cuidado com SEO client-side** (achado negativo do Guichê Web) — reforça que nossa abordagem (SSR com Next.js, sitemap dinâmico) já está no caminho certo; é um ponto que vale destacar como vantagem nossa.

## 3. Quem eu analisei (1ª rodada, mantida)

| Plataforma | Situação |
|---|---|
| **Sympla** | Líder do mercado brasileiro — e ficou **ainda maior**: a Eventbrite **encerrou operações no Brasil em dezembro/2025** (citou "instabilidade regulatória"), e a Sympla está absorvendo boa parte da migração |
| **Ingresse** | Foco em shows/festivais de maior porte, modelo mais "sob consulta" que autoatendimento |
| **Even3** | Forte em eventos acadêmicos/científicos (inscrições, certificados) |
| **Catraca Virtual** | Concorrente direto de preço com a Sympla, taxa fixa (vantagem em ingressos de valor mais alto) |
| **Zig** | Plataforma B2B para ingressos, foco em times/arenas |
| **Lets.events** | Diferencial em gestão de lista de convidados |
| **Ticketmaster / SeatGeek / StubHub** | Referências internacionais |

## 4. O que os concorrentes fazem bem (padrões que se repetem — 1ª rodada)

1. **Prova social explícita** — fotos/vídeos de edições anteriores, depoimentos, "local lotado" em edições passadas
2. **Urgência real, não genérica** — contador regressivo, quantos restam no lote atual
3. **Ficha técnica completa e escaneável** — o quê, quando, onde, quanto, e informações práticas
4. **Upsell/cross-sell no checkout** (Sympla Store)
5. **Compartilhamento fácil** — botões de rede social, cupom de indicação
6. **Identidade visual do evento** — a página "veste a camisa" do evento

## 5. O que já temos que já bate com esses padrões
- ✅ Hero redesenhado, lotes com indicação de vendas, reembolso automático, badges de pagamento seguro
- ✅ Mapa embutido (corrigido)
- ✅ Sistema de repasse/split transparente
- ✅ SSR completo (SEO melhor que pelo menos um concorrente direto — Guichê Web)

## 6. Oportunidades concretas — proposta priorizada (atualizada)

### 6.1 Prova social (maior impacto, esforço médio)
- Galeria de fotos de edições anteriores no cadastro do evento
- "X pessoas já confirmaram presença" perto do botão de compra

### 6.2 Urgência mais visível (baixo esforço, alto impacto)
- Contador regressivo + barra de progresso do lote atual (já temos os dados)

### 6.3 Recuperação de carrinho abandonado (novo, 2ª rodada — esforço médio)
- E-mail automático pra quem iniciou e não terminou a compra — usando a fila de e-mail confiável que já existe

### 6.4 Ficha técnica mais completa (baixo esforço)
- Classificação etária, dress code, estacionamento como campos estruturados

### 6.5 Compartilhar e indicar (baixo esforço)
- Botões de compartilhamento (WhatsApp, Instagram Stories, copiar link)
- Botão de WhatsApp visível pro "Fale conosco" (novo, 2ª rodada — padrão do mercado brasileiro)

### 6.6 Consistência na página (achado da varredura)
- Consolidar a repetição do local do evento (aparece em até 3 lugares hoje)

## 7. O que eu NÃO recomendo copiar agora
- **Upsell/loja integrada**: feature grande, spec dedicado depois do lançamento
- **App próprio / POS físico / revenda white-label pra terceiros**: fora do nosso modelo de negócio (somos B2C, não SaaS B2B como AppTicket/PagTickets/G-ticket)
- **Gamificação de pré-evento**: fora de escopo pro momento de lançamento

## 8. Proposta de ordem de execução (se você aprovar)

1. Corrigir a repetição de informação (rápido)
2. Urgência mais visível (contador + barra de progresso)
3. "X pessoas confirmaram" (já temos os dados)
4. Botões de compartilhamento + WhatsApp no contato
5. Campos estruturados de ficha técnica
6. Recuperação de carrinho abandonado (mais trabalhoso, mas alto potencial de retorno)

---

**Aguardando sua aprovação pra transformar isso num `/spec` e depois `/build`.** Quer que eu comece por algum item específico, ou sigo a ordem sugerida?

