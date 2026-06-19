# Spec: Patamar completo — UX, produto e transparência financeira

**Versão:** 1.0  
**Data:** 2026-06-16  
**Comando associado:** `/build` lê este arquivo; `/review` valida contra este arquivo.

---

## 1. Objetivo

Elevar o EventosBR ao próximo patamar de produto e confiança de mercado, implementando **no repositório** todas as melhorias de layout/UX sugeridas na análise comparativa (Sympla, Even3, Guichê Web, Ingresse), funcionalidades de roadmap (parcelamento, listas, página do organizador, central de ajuda, etc.) e **transparência financeira fidedigna** (taxas EventosBR + Asaas + simuladores para organizador e comprador).

**Marca e domínio (fixos):**
- Marca pública: **EventosBR**
- Domínio: **`eventosbr.app.br`**

**Escopo de execução:**
- **Incluído no `/build`:** tudo que pode ser feito no código, testes, documentação e scripts no repositório.
- **Fora do `/build` (Anexo B):** ações no VPS Hostinger, DNS, credenciais, certificados Apple/Google Wallet — listadas para o usuário executar depois.

**Restrições globais:**
- Não usar nomes de domínio/marca com **“guichê”** (conflito com Guichê Web).
- **Não poluir a UI:** progressive disclosure; vista padrão da vitrine permanece limpa.
- Direção visual **híbrida:** base **esmeralda + zinc**; hero/vitrine mais visuais; checkout/organizador sóbrios; acento **âmbar** apenas em badges de urgência (opcional).
- Ativos externos (logo final, fotos, chaves API): **placeholders via `.env`** até o usuário fornecer (Anexo A).
- Referência de taxas Asaas: [Preços e taxas Asaas](https://www.asaas.com/precos-e-taxas) — valores devem ser **configuráveis** no código (constantes/documentação) para atualização sem reescrever lógica.

---

## 2. Requisitos — Identidade e marketing (P0)

### REQ-01 — Logo EventosBR
- Adicionar **logo** (ícone + wordmark) na navbar e footer.
- Implementar versão SVG **placeholder** no repositório; substituível via `NEXT_PUBLIC_LOGO_URL` ou asset estático quando o usuário enviar logo final.
- **Concluído quando:** navbar não exibe apenas texto “EventosBR” sem ícone.

### REQ-02 — Hero da home com imagem
- Home (`/`) deve ter **hero visual** (imagem de fundo ou collage de eventos).
- Prioridade: imagens de **eventos publicados** na plataforma; fallback para imagem default em `/public/`.
- Manter headline e CTAs atuais; não remover `HomeHeroExplorar` nem prova social.
- **Concluído quando:** home não é apenas texto centralizado.

### REQ-03 — Destaques de diferenciação na home
- Seção visível com **3 diferenciais reais do produto:**
  1. Compra rápida (sem cadastro completo)
  2. Reembolso automático (prazo legal)
  3. Repasse oficial de ingresso
- Links para `/funcionalidades` ou âncoras relevantes.
- **Concluído quando:** seção existe acima ou abaixo dos eventos em destaque.

### REQ-04 — Busca na navbar
- Campo de busca na navbar (desktop) e acesso equivalente no menu mobile.
- Submete para `/eventos?q={termo}` (reutilizar vitrine existente).
- **Concluído quando:** usuário busca sem ir manualmente à vitrine.

### REQ-05 — Footer profissional
- Links de redes sociais via env: `NEXT_PUBLIC_SOCIAL_INSTAGRAM_URL`, `NEXT_PUBLIC_SOCIAL_WHATSAPP_URL`, `NEXT_PUBLIC_EMAIL_CONTATO` (ou equivalentes documentados).
- **Remover** exibição de host/API bruto ao usuário final.
- **Concluído quando:** footer sem links `#` mortos por padrão (placeholders vazios = ocultar ícone, não link quebrado).

### REQ-06 — Consistência de pagamento no comprador
- `compra-info-confianca.tsx` e `checkout-preco-detalhe.tsx` citam **gateway de pagamento certificado** (sem expor marca do provedor ao comprador).
- Transparência de taxas: preço final, taxa EventosBR e nota de processamento **conforme método** (PIX, cartão, parcelas).
- Painel do organizador (`/organizador/financeiro`) pode citar Asaas para configuração de repasses.
- **Concluído quando:** página de evento + checkout sem texto contraditório nem menção a processadores legados.

### REQ-07 — Badges de pagamento no checkout
- Exibir selos visuais: **PIX**, **Cartão**, **Pagamento seguro** (ícones SVG, não emojis).
- **Concluído quando:** passo 2 do checkout mostra badges acima ou abaixo do formulário.

---

## 3. Requisitos — Vitrine e descoberta (P1)

### REQ-08 — Filtros de data (sem calendário visual)
- Em `/eventos`, adicionar chips: **Hoje**, **Este fim de semana**, **Esta semana**.
- Seletor de intervalo de datas (início/fim) via `<input type="date">` + botão **Aplicar** (sem grade/calendário mensal).
- **Não** implementar grade/calendário mensal (decisão explícita para evitar poluição).
- Vista **padrão:** lista/grid atual.
- **Concluído quando:** chips filtram resultados; intervalo customizado atualiza URL `?de=&ate=`; E2E cobre chip e intervalo.

### REQ-09 — Mapa na página do evento
- Sempre exibir endereço + botão **“Abrir no Google Maps”** (link externo).
- Se `GOOGLE_MAPS_API_KEY` definida no `.env` da API ou `NEXT_PUBLIC_GOOGLE_MAPS_EMBED_KEY` no front: exibir **mapa embutido**.
- Sem chave: apenas link (sem erro visível).
- **Concluído quando:** evento com `local` preenchido mostra bloco de localização.

### REQ-10 — Urgência / escassez (configurável por evento)
- Campo no painel do organizador (edição do evento): modo de exibição:
  - `desligado`
  - `exato` (ex.: “Restam 7 ingressos”)
  - `faixa` (ex.: “Últimos ingressos”, “Menos de 10” — thresholds documentados no código)
- Exibir na página do evento e no checkout quando ativo.
- Usar acento âmbar apenas nestes badges.
- **Concluído quando:** organizador altera modo e comprador vê resultado coerente com estoque do lote.

### REQ-11 — Eventos relacionados
- Na página do evento, seção “Você também pode gostar” (máx. **4**):
  1. Prioridade: outros eventos **do mesmo organizador** (publicados, venda aberta ou em breve documentado).
  2. Completar: mesma **cidade** + **categoria**.
  3. Excluir evento atual.
- **Concluído quando:** API ou query retorna lista; UI renderiza cards da vitrine.

### REQ-12 — Unificar pricing home vs `/planos`
- Extrair cards de preço para **componente compartilhado**; home pode mostrar resumo com link “Ver detalhes” para `/planos`.
- Evitar manutenção duplicada de textos de taxa.
- **Concluído quando:** alterar taxa em um lugar reflete no outro.

### REQ-13 — Planos: ícones SVG
- Substituir emojis ✅ nos cards de `/planos` (e home se ainda listar features) por ícones SVG consistentes com o design system.
- **Concluído quando:** nenhum ✅ Unicode nos cards de planos.

### REQ-14 — `/funcionalidades` com screenshots reais
- Substituir Unsplash por **screenshots do produto** (PNG/WebP em `/public/marketing/`).
- Gerados via `scripts/generate_marketing_png.py` (mockups fidedignos das telas); substituíveis por capturas reais do usuário.
- **Concluído quando:** página não depende de stock photos genéricos.

---

## 4. Requisitos — Transparência financeira e simuladores (P1/P2)

### REQ-15 — Taxas públicas documentadas no código
- Arquivo único de referência (ex.: `app/services/taxas_asaas_publicas.py` + extensão frontend espelhada) com taxas Asaas **padrão** conforme página oficial (jun/2026):
  - PIX: R$ 1,99 / transação
  - Boleto: R$ 1,99 / transação
  - Cartão à vista: R$ 0,49 + 2,99%
  - Cartão 2–6x: R$ 0,49 + 3,49%
  - Cartão 7–12x: R$ 0,49 + 3,99%
  - (Documentar que taxas promocionais/conta específica podem variar — aviso legal)
- Taxas EventosBR: usar `tarifas_plataforma.py` / `tarifas-plataforma.ts` existentes.
- **Concluído quando:** simuladores leem destas fontes, não valores hardcoded espalhados.

### REQ-16 — Simuladores em todos os pontos (letra E)
Implementar ou expandir simuladores **fidedignos** (organizador vê líquido; comprador vê total) em:

| Local | O que mostrar |
|-------|----------------|
| `/planos` | Lucro por volume; comparativo plano padrão vs assinatura; **comparativo ilustrativo Sympla** com disclaimer |
| Wizard / criação e edição de evento | Estimativa por ingresso (bruto → taxa EventosBR → taxa Asaas estimada → líquido) |
| Painel Financeiro | Expandir simulador Asaas existente + breakdown completo |
| Página do evento / checkout | Comprador vê **preço final** e nota de transparência (“taxas de processamento incluídas conforme método”) |

- Comparativo Sympla: usar taxas **públicas divulgadas** pela Sympla (constante documentada + link fonte); texto **“valores ilustrativos, conferir nos sites oficiais”**.
- **Concluído quando:** os 4 superfícies renderizam números coerentes entre si para o mesmo preço de ingresso.

### REQ-17 — Avisos legais
- Todo simulador exibe nota: valores **estimativos**; taxas de **processamento** podem variar por conta/antecipação; não constitui oferta fiscal.
- No painel do organizador pode citar taxas do gateway (Asaas) explicitamente.
- **Concluído quando:** disclaimer visível em cada simulador.

---

## 5. Requisitos — Parcelamento (P2)

### REQ-18 — Configuração pelo organizador
- Por evento (ou por lote pago — documentar escolha na implementação; **mínimo:** por evento):
  - `parcelamento_habilitado`: boolean
  - `parcelamento_max`: enum `2` | `3` | `6` | `12`
- Organizador **define se haverá parcelamento**; padrão desligado.
- **Concluído quando:** campos persistidos (migração Alembic); UI na edição do evento.

### REQ-19 — Integração Asaas
- Checkout cartão: enviar parcelamento à API Asaas conforme documentação oficial (número de parcelas selecionado pelo comprador até o máximo do evento).
- Aplicar taxas Asaas de parcelamento conforme REQ-15 (faixa 2–6 vs 7–12).
- Exibir ao **comprador** antes de confirmar: parcelas, valor da parcela, total; taxas de processamento conforme método.
- Exibir ao **organizador** no simulador: impacto do parcelamento no líquido.
- **Concluído quando:** compra parcelada em sandbox/mock ou teste documentado passa; webhook confirma pagamento.

### REQ-20 — Casos extremos parcelamento
- Evento gratuito / cortesia: sem parcelamento.
- Valor abaixo do mínimo Asaas (definir mínimo R$ 5,00 ou documentar): desabilitar parcelas ou mostrar mensagem.
- Parcelamento desligado: checkout só à vista.
- Falha API Asaas: mensagem em português; não perder reserva sem ação do usuário (comportamento atual de reserva mantido).

---

## 6. Requisitos — Lista de interesse (P2)

### REQ-21 — Captação pré-venda
- Na página do evento, quando vendas **ainda não abertas** (lote futuro ou evento com flag `aceita_interesse`): formulário e-mail + opcional nome.
- Persistir inscrições por evento; deduplicar por e-mail.
- **Concluído quando:** organizador vê lista no painel + export CSV.

### REQ-22 — Notificação na abertura de vendas
- Quando organizador publica ou abre lote: **e-mail automático** aos inscritos com link do evento.
- Fila de e-mail existente (Redis/worker) deve ser usada.
- **Concluído quando:** teste com e-mail mock/SMTP dev envia 1 notificação.

---

## 7. Requisitos — Lista de espera (P2)

### REQ-23 — Inscrição na espera
- Quando lote **esgotado** e organizador habilitou lista de espera: formulário para entrar na fila (usuário logado ou e-mail + nome).
- Posição na fila **FIFO** por lote/evento.
- **Concluído quando:** usuário vê confirmação de entrada na fila.

### REQ-24 — Liberação de vaga
- Ao cancelar ingresso pago / liberar vaga: próximo da fila recebe:
  1. **E-mail** com link exclusivo de compra
  2. **Notificação in-app** (Minha conta — badge ou lista de notificações simples)
- Prazo para comprar: organizador escolhe **12h, 24h ou 48h** (default 24h).
- Link expira; se expirar, oferecer ao próximo da fila automaticamente.
- **Concluído quando:** teste automatizado cobre fluxo cancelamento → e-mail → compra; expiração documentada.

### REQ-25 — Casos extremos lista de espera
- Usuário já tem ingresso pago no evento: não pode entrar na espera.
- Duplicata na fila: rejeitar ou atualizar posição (documentar: **manter uma entrada por e-mail**).
- Múltiplas vagas liberadas simultaneamente: respeitar ordem FIFO.

---

## 8. Requisitos — Página pública do organizador (P2)

### REQ-26 — Rota pública
- URL: `/organizador/[slug]` ou `/produtor/[slug]` (escolher uma; **preferência:** `/organizador/[slug]` se não conflitar com painel — se conflitar, usar `/produtor/[slug]` e documentar na build).
- Slug gerado a partir do nome do organizador (único).

### REQ-27 — Conteúdo
- Nome, foto/logo, bio curta
- Redes sociais e contato (campos no perfil do organizador)
- Grid de **eventos públicos** dele
- Métricas **reais** quando disponíveis: total de eventos publicados, ingressos pagos (agregado), sem inventar números
- **Concluído quando:** página renderiza para organizador com ≥1 evento público.

---

## 9. Requisitos — Central de ajuda e blog (P2)

### REQ-28 — Central de ajuda
- Rotas estáticas Next.js, mínimo:
  - `/ajuda` (índice)
  - `/ajuda/como-comprar`
  - `/ajuda/como-criar-evento`
  - `/ajuda/reembolsos`
  - `/ajuda/parcelamento-e-taxas`
- Links no footer.
- **Concluído quando:** 5 páginas acessíveis e linkadas.

### REQ-29 — Blog Markdown
- Posts em `content/blog/*.md` (ou pasta equivalente) com frontmatter (title, date, excerpt).
- Listagem `/blog` e post `/blog/[slug]`.
- **Concluído quando:** ≥1 post de exemplo (“Bem-vindo ao EventosBR”) incluído.

---

## 10. Requisitos — Apple/Google Wallet (P2)

### REQ-30 — Fase atual
- Melhorar **PDF/HTML do ingresso** e tela QR existentes (legibilidade, nome do evento, participante).
- Botão **“Adicionar à Carteira”** com estado **“Em breve”** (disabled + tooltip).
- Documentar em `docs/wallet-passes.md` requisitos de certificados Apple/Google e variáveis futuras.
- **Concluído quando:** UI não promete Wallet funcional; doc existe.

---

## 11. Requisitos — Operação e go-live (repositório)

### REQ-31 — Template `.env` para `eventosbr.app.br`
- Atualizar `.env.production.example` com domínio `eventosbr.app.br` e novas env vars desta spec (mapas, redes sociais, logo).

### REQ-32 — Scripts e docs já existentes
- Manter e referenciar: `configure-asaas-env.sh`, `backup-postgres-cron.sh`, `monitor-ready.sh`, `verify-production.sh`, `docs/11-go-live-asaas.md`.
- **Concluído quando:** Anexo B desta spec alinhado com scripts.

---

## 12. Qualidade e definição de “concluído” global

### REQ-33 — Testes automatizados
- Todos os testes `pytest` existentes continuam passando.
- Novos testes para fluxos críticos:
  - Parcelamento (config + cálculo de taxas)
  - Lista de interesse (inscrição + export)
  - Lista de espera (FIFO + expiração de link)
  - Simuladores (valores consistentes)
  - Eventos relacionados (prioridade organizador)

### REQ-34 — E2E Playwright
- Cobrir no mínimo:
  - Busca navbar → vitrine
  - Filtro “Este fim de semana”
  - Seletor de intervalo de datas (início/fim) na vitrine
  - Checkout com copy de **pagamento seguro** (sem expor marca do gateway ao comprador)
  - Entrada lista de interesse (evento pré-venda via API mock E2E)
- **Implementação:** `frontend/e2e/patamar-ux.spec.ts`; testes com API no job CI `e2e-compra` (lista interesse, lista espera, produtor; requer `PLAYWRIGHT_API_URL`). Copy e parcelamento no checkout: `frontend/e2e/compra-checkout-asaas.spec.ts` (job `e2e-asaas`).

### REQ-35 — Revisão manual (Anexo C)
- Build só é aprovada no `/review` quando Anexo C estiver 100% verificado.

### Definição de “concluído” (`/build` terminado)
1. Todos os requisitos **REQ-01 a REQ-35** implementados ou explicitamente delegados ao Anexo B (somente itens de infraestrutura).
2. `pytest` verde; E2E novos verdes ou skip documentado com motivo técnico bloqueante.
3. Lista de requisitos atendidos entregue no output do `/build`.
4. Anexo A preenchido com o que ainda falta do usuário (se houver).

---

## 13. Casos extremos gerais

| Situação | Comportamento esperado |
|----------|------------------------|
| Asaas desabilitado / mock | Simuladores funcionam; parcelamento oculto |
| Evento pausado | Não aparece na vitrine; página direta mostra aviso |
| Organizador sem wallet Asaas | Checkout pago bloqueado (comportamento atual) |
| Sem `GOOGLE_MAPS_API_KEY` | Só link externo Google Maps |
| Sem URLs de redes sociais | Ícones ocultos no footer |
| Sympla comparator | Sempre com disclaimer “ilustrativo” |

---

## Anexo A — Itens que o usuário deve fornecer (pós-build)

| Item | Variável / local | Obrigatório para produção |
|------|------------------|---------------------------|
| Logo final | `/public/logo.svg` ou `NEXT_PUBLIC_LOGO_URL` | Recomendado |
| Screenshots marketing | `/public/marketing/` | Opcional (build gera fallback) |
| `ASAAS_API_KEY` (nova) | `.env` VPS | Sim |
| `ASAAS_PLATFORM_WALLET_ID` | `.env` | Sim |
| `ASAAS_WEBHOOK_TOKEN` | `.env` | Sim |
| `GOOGLE_MAPS_EMBED_KEY` | `.env` | Opcional |
| `GOOGLE_OAUTH_CLIENT_ID` | `.env` | Se login Google |
| Instagram / WhatsApp URLs | `NEXT_PUBLIC_SOCIAL_*` | Recomendado |
| E-mail SMTP | `EMAIL_*` | Sim |
| Certificados Apple/Google Wallet | futuro | Não nesta fase |

---

## Anexo B — Produção Hostinger (usuário executa; fora do `/build`)

1. Registrar **`eventosbr.app.br`** e apontar DNS `A` @ e `www` → IP VPS  
2. Clonar repo em `/opt/eventosbr`  
3. `cp .env.production.example .env` — preencher secrets + Asaas  
4. `./scripts/deploy-vps.sh`  
5. `./scripts/verify-production.sh`  
6. Webhook Asaas → `https://eventosbr.app.br/api/webhooks/asaas`  
7. SPF/DKIM e-mail `noreply@eventosbr.app.br`  
8. Cron: `backup-postgres-cron.sh`, `monitor-ready.sh`  
9. Organizadores: walletId em Financeiro  
10. 1ª venda real teste  

---

## Anexo C — Checklist de revisão manual (`/review`)

- [x] Home: hero com imagem + diferenciais + logo  
- [x] Navbar: busca funciona  
- [x] Footer: sem links mortos; redes ocultas ou válidas  
- [x] Página evento: mapa/link, relacionados, urgência, simulador comprador  
- [x] Checkout: badges PIX/cartão/seguro; sem texto de outro processador  
- [x] Vitrine: chips Hoje/Fim de semana/Semana; intervalo De/Até; sem calendário mensal  
- [x] `/planos`: ícones SVG; comparativo Sympla com disclaimer; simulador com taxa Asaas  
- [x] Wizard + Financeiro: simuladores coerentes  
- [x] Parcelamento: toggle organizador 2/3/6/12x; checkout parcelas  
- [x] Lista interesse: form + CSV + e-mail abertura  
- [x] Lista espera: fila + e-mail + notificação conta + prazo 12/24/48h  
- [x] Página pública organizador (`/produtor/{slug}`)  
- [x] `/ajuda` + `/blog`  
- [x] Wallet: “Em breve” + doc; tela `/ingresso/qr` com evento e participante  
- [x] Mobile: smoke E2E viewport 390px (home + vitrine sem overflow horizontal) — **validação em dispositivo real recomendada**  
- [x] `pytest` + E2E verdes (CI)  
- [ ] Go-live VPS (`eventosbr.app.br`) — **Anexo B (usuário)**  

---

## Histórico da entrevista `/spec`

| Tópico | Decisão |
|--------|---------|
| Escopo | Todas as melhorias sugeridas; código local + Anexo B para VPS |
| Marca/domínio | EventosBR + eventosbr.app.br |
| Visual | Híbrido esmeralda/zinc + hero visual; âmbar só urgência |
| Parcelamento | Organizador liga/desliga; máx 2/3/6/12x; taxas Asaas transparentes |
| Listas | Interesse + espera; e-mail+conta; CSV; prazo 12/24/48h |
| Página organizador | Perfil público + métricas reais |
| Ajuda/blog | Estático + Markdown |
| Wallet | PDF/QR + “Em breve” + doc |
| Vitrine | Lista padrão; chips data; **sem** calendário visual |
| Relacionados | Organizador primeiro, depois cidade+categoria |
| Mapa | Link + embed se chave Google |
| Urgência | Organizador: exato/faixa/off |
| Simuladores | Todos os pontos; taxas públicas; Sympla ilustrativo |
| Qualidade | pytest + E2E + Anexo C |
