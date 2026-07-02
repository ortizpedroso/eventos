# Spec: EventosBR — Produto completo (UX + Repasse Asaas)

**Versão:** 2.0  
**Data:** 2026-07-01  
**Status:** aprovada  
**Comando:** `/build` lê este arquivo; `/review` valida contra este arquivo.

> Spec única consolidada. Substitui `patamar-completo-ux-produto.md` e `repasse-asaas-pagamentos.md`.

---

## 1. Objetivo

Elevar o EventosBR ao patamar de produto e confiança de mercado (UX, vitrine, parcelamento, listas, ajuda, blog) e garantir **repasse financeiro fidedigno** via Asaas: split automático na venda, financeiro white-label para o organizador (saldo, extrato, saque Pix) e checkout seguro para o comprador.

**Marca e domínio (fixos):**
- Marca pública: **EventosBR**
- Domínio: **`eventosbr.app.br`**

**Escopo de execução:**
- **Incluído no `/build`:** código, testes, documentação e scripts no repositório.
- **Fora do `/build` (Anexo B):** VPS, DNS, credenciais de produção, certificados Apple/Google Wallet, NFSe.

**Restrições globais:**
- Não usar nomes de domínio/marca com **“guichê”**.
- **Não poluir a UI:** progressive disclosure; vitrine limpa por padrão.
- Visual **híbrido:** esmeralda + zinc; hero visual; checkout/organizador sóbrios; âmbar só em badges de urgência.
- Ativos externos via `.env` até o usuário fornecer (Anexo A).
- Taxas Asaas configuráveis em `taxas_asaas_publicas.py` / espelho frontend.

---

## 2. Requisitos — Identidade e marketing (P0)

### REQ-01 — Logo EventosBR
- Logo (ícone + wordmark) na navbar e footer.
- SVG placeholder no repositório; substituível via `NEXT_PUBLIC_LOGO_URL`.
- **Concluído quando:** navbar não exibe apenas texto sem ícone.

### REQ-02 — Hero da home com imagem
- Home com hero visual (imagem de fundo ou collage de eventos publicados; fallback `/public/`).
- Manter headline, CTAs, `HomeHeroExplorar` e prova social.

### REQ-03 — Destaques de diferenciação na home
- Seção com 3 diferenciais: compra rápida, reembolso automático, repasse oficial de ingresso.
- Links para `/funcionalidades` ou âncoras relevantes.

### REQ-04 — Busca na navbar
- Campo de busca (desktop) e equivalente no mobile → `/eventos?q={termo}`.

### REQ-05 — Footer profissional
- Redes via `NEXT_PUBLIC_SOCIAL_INSTAGRAM_URL`, `NEXT_PUBLIC_SOCIAL_WHATSAPP_URL`, `NEXT_PUBLIC_EMAIL_CONTATO`.
- Sem host/API bruto; placeholders vazios = ocultar ícone (não link `#` morto).

### REQ-06 — Consistência de pagamento (modelo all-in comprador + financeiro organizador)
- **Comprador:** `compra-info-confianca.tsx` e `checkout-preco-detalhe.tsx` citam gateway certificado (sem marca do provedor); preço do ingresso + total (parcelamento quando aplicável); sem breakdown de taxa EventosBR nem “organizador recebe”; sem menção a processadores legados (Stripe etc.).
- **Organizador:** vê taxa EventosBR e líquido em wizard, planos e painel financeiro.
- **Repasse na venda:** split automático organizador + plataforma no momento do pagamento (`split_para_evento()`).
- **Saque Pix white-label:** após carência (`FINANCEIRO_CARENCIA_SAQUE_HORAS`, default 48h), organizador solicita transferência Pix na plataforma (`saque_habilitado: true` quando repasse aprovado) — sem acessar painel Asaas.

### REQ-07 — Badges de pagamento no checkout
- Selos SVG: PIX, Cartão, Pagamento seguro no passo 2 do checkout.

---

## 3. Requisitos — Vitrine e descoberta (P1)

### REQ-08 — Filtros de data (sem calendário visual)
- Chips: Hoje, Este fim de semana, Esta semana; intervalo `<input type="date">` + Aplicar; URL `?de=&ate=`; E2E cobre chip e intervalo.
- **Sem** grade/calendário mensal.

### REQ-09 — Mapa na página do evento
- Endereço + “Abrir no Google Maps”; embed se `NEXT_PUBLIC_GOOGLE_MAPS_EMBED_KEY` ou `GOOGLE_MAPS_API_KEY`; sem chave = só link (sem erro).

### REQ-10 — Urgência / escassez
- Modos: `desligado`, `exato`, `faixa`; configurável pelo organizador; badge âmbar na página do evento e checkout.

### REQ-11 — Eventos relacionados
- Máx. 4: prioridade mesmo organizador → cidade+categoria; excluir evento atual.

### REQ-12 — Pricing unificado home vs `/planos`
- Componente compartilhado `planos-pricing-cards.tsx`.

### REQ-13 — Planos: ícones SVG
- Sem emoji ✅ nos cards de planos.

### REQ-14 — `/funcionalidades` com screenshots do produto
- PNGs em `/public/marketing/` gerados por `scripts/generate_marketing_png.py` (commitados no repo).
- **Concluído quando:** imagens carregam (não dependem de stock photos nem SVG órfão).

---

## 4. Requisitos — Transparência financeira e simuladores (P1/P2)

### REQ-15 — Taxas públicas documentadas
- Fonte única: `app/services/taxas_asaas_publicas.py` + `frontend/src/lib/taxas-asaas-publicas.ts`.
- Taxas EventosBR: `tarifas_plataforma.py` / `tarifas-plataforma.ts`.

### REQ-16 — Simuladores nas 4 superfícies
- `/planos`, wizard/edição evento, painel financeiro, checkout comprador — números coerentes; comparativo Sympla com disclaimer ilustrativo.

### REQ-17 — Avisos legais
- Constante `AVISO_LEGAL_TAXAS` (backend + frontend) com texto:
  > Valores estimativos. Taxas de processamento podem variar por conta, antecipação e condições do provedor. Não constitui oferta fiscal. A taxa EventosBR é fixa por plano; parcelamento pode incluir acréscimo explícito ao comprador.
- Exibido em **todos** os simuladores, incluindo `ingresso-preco-calculadora.tsx`.
- Organizador pode citar taxas do gateway (Asaas) explicitamente no painel.

---

## 5. Requisitos — Parcelamento (P2)

### REQ-18 — Configuração pelo organizador
- `parcelamento_habilitado`, `parcelamento_max` (2|3|6|12) por evento; padrão desligado.

### REQ-19 — Integração Asaas
- `installmentCount` no checkout; taxas 2–6 vs 7–12; exibição ao comprador e simulador organizador.

### REQ-20 — Casos extremos parcelamento
- Cortesia sem parcelamento; mínimo R$ 10; desligado = à vista; falha API em PT; validação Luhn client+server.

---

## 6. Requisitos — Lista de interesse (P2)

### REQ-21 — Captação pré-venda
- Formulário quando vendas não abertas; dedup e-mail; export CSV no painel.

### REQ-22 — Notificação na abertura de vendas
- E-mail automático via fila Redis ao publicar/abrir lote.

---

## 7. Requisitos — Lista de espera (P2)

### REQ-23 — Inscrição na espera
- FIFO por lote/evento quando esgotado e habilitado.

### REQ-24 — Liberação de vaga
- E-mail + notificação in-app; prazo 12/24/48h; expiração → próximo da fila.

### REQ-25 — Casos extremos lista de espera
- Uma entrada por e-mail; quem já tem ingresso pago não entra; FIFO em liberações múltiplas.

---

## 8. Requisitos — Página pública do organizador (P2)

### REQ-26 — Rota pública
- `/produtor/[slug]` (painel autenticado usa `/organizador`).

### REQ-27 — Conteúdo
- Nome, foto, bio, redes, grid de eventos públicos, métricas reais (eventos publicados, ingressos pagos).

---

## 9. Requisitos — Central de ajuda e blog (P2)

### REQ-28 — Central de ajuda
- `/ajuda`, `/ajuda/como-comprar`, `/ajuda/como-criar-evento`, `/ajuda/reembolsos`, `/ajuda/parcelamento-e-taxas`.

### REQ-29 — Blog Markdown
- `content/blog/*.md`; `/blog` e `/blog/[slug]`; post exemplo incluído.

---

## 10. Requisitos — Apple/Google Wallet (P2)

### REQ-30 — Fase atual
- PDF/HTML e QR melhorados; botão “Adicionar à Carteira” = “Em breve”; `docs/wallet-passes.md`.

---

## 11. Requisitos — Operação e go-live (repositório)

### REQ-31 — Template `.env` para `eventosbr.app.br`
- `.env.production.example` com domínio, Asaas, logo, redes, `NEXT_PUBLIC_GOOGLE_MAPS_EMBED_KEY`.
- `GOOGLE_MAPS_API_KEY` — configurável pelo usuário em sessão dedicada (Anexo A).

### REQ-32 — Scripts e docs
- `configure-asaas-env.sh`, `configure-google-maps-env.sh`, `backup-postgres-cron.sh`, `monitor-ready.sh`, `verify-production.sh`, `atualizar-vps-agora.sh`, `docs/11-go-live-asaas.md`.

---

## 12. Requisitos — Repasse Asaas e financeiro white-label (P0)

### REQ-36 — Split na venda
- Organizador: preço − taxa EventosBR; plataforma: taxa EventosBR; Asaas: fora do split.
- Implementação: `pagamento_asaas.py` → `split_para_evento()`; ledger em `registrar_ledger_ingressos_lote()`.

### REQ-37 — Conta de repasse (KYC)
- Subconta via `POST /api/organizador/asaas/subconta`; status pending → awaiting_approval → approved|rejected.
- Eventos pagos só publicados/vendidos com repasse aprovado.
- Sync: webhook `ACCOUNT_STATUS_*` + poll UI 20s.

### REQ-38 — Saque Pix white-label
- `POST /api/organizador/financeiro/saque` → Asaas transfers; carência 48h; chave Pix = CPF/CNPJ cadastro; comprovante JSON.

### REQ-39 — Saldo e conciliação
- `liquido_acumulado`, `saldo_em_carencia`, `saldo_disponivel_saque`, `saldo_asaas.balance`.
- Conciliação: `ledger.saldo_esperado_asaas = liquido_acumulado − saques_pagos_total`; alerta se |diferença| > R$ 0,05.

### REQ-40 — Extrato e relatórios
- Extrato com vendas, estornos, saques; vendas agrupadas por período/evento.

### REQ-41 — Webhooks Asaas
- `POST /api/webhooks/asaas`; header `asaas-access-token`; eventos PAYMENT_*, ACCOUNT_STATUS_*, TRANSFER_*; idempotência `WebhookEvent.id`.

### REQ-42 — Autorização de saques (BaaS)
- `POST /api/webhooks/asaas/transfer-auth`; IP whitelist VPS; resposta APPROVED/REFUSED.

### REQ-43 — Assinatura mensal plataforma
- Cobrança 100% plataforma; reutilizar PIX pendente; idempotency; poll/sincronizar.

### REQ-44 — Variáveis de ambiente repasse
- `ASAAS_API_KEY`, `ASAAS_PLATFORM_WALLET_ID`, `ASAAS_WEBHOOK_TOKEN`, `FRONTEND_PUBLIC_URL`, `FINANCEIRO_CARENCIA_SAQUE_HORAS`, `FINANCEIRO_PRAZO_TRANSFERENCIA_HORAS`, `ASAAS_ALLOW_MANUAL_WALLET=false`.

### REQ-45 — Pagamento comprador e fulfillment
- Checkout bloqueado sem repasse; webhooks marcam `pago_em`; reembolso automático se fulfillment bloqueado.

---

## 13. Qualidade e definição de “concluído” global

### REQ-33 — Testes automatizados
- `pytest` verde; testes para parcelamento, listas, simuladores, relacionados, repasse, webhooks.

### REQ-34 — E2E Playwright
- `frontend/e2e/patamar-ux.spec.ts`, `compra-checkout-asaas.spec.ts`; CI jobs `e2e`, `e2e-compra`, `e2e-asaas`.

### REQ-35 — Revisão manual (Anexo C)
- Build aprovada no `/review` quando Anexo C verificado (exceto itens Anexo B).

### Definição de “concluído” (`/build`)
1. REQ-01 a REQ-45 implementados ou delegados ao Anexo B.
2. `pytest` verde; E2E verdes ou skip documentado.
3. Lista de requisitos no output do `/build`.

---

## 14. Casos extremos gerais

| Situação | Comportamento esperado |
|----------|------------------------|
| Asaas desabilitado / mock | Simuladores funcionam; parcelamento oculto |
| Evento pausado | Não na vitrine; aviso na URL direta |
| Organizador sem wallet/KYC | Checkout pago bloqueado |
| Sem chave Google Maps | Só link externo |
| Sem redes sociais | Ícones ocultos no footer |
| Sympla comparator | Disclaimer “ilustrativo” |

---

## Anexo A — Itens do usuário (pós-build)

| Item | Variável | Obrigatório |
|------|----------|-------------|
| Logo final | `NEXT_PUBLIC_LOGO_URL` | Recomendado |
| Asaas produção | `ASAAS_*` | Sim |
| SMTP | `EMAIL_*` | Sim |
| Google Maps embed | `NEXT_PUBLIC_GOOGLE_MAPS_EMBED_KEY` | Configurado em produção |
| Google OAuth | `GOOGLE_OAUTH_CLIENT_ID` | Configurado em produção |
| Google Maps API | `GOOGLE_MAPS_API_KEY` | Não necessário (embed usa chave acima) |
| Redes sociais | `NEXT_PUBLIC_SOCIAL_*` | Recomendado |
| Apple/Google Wallet | futuro | Não nesta fase |

---

## Anexo B — Produção VPS (usuário executa)

1. DNS `eventosbr.app.br` → VPS  
2. `/opt/eventosbr` + `.env`  
3. `./scripts/atualizar-vps-agora.sh`  
4. `./scripts/verify-production.sh`  
5. Webhooks Asaas (pagamento + transfer-auth)  
6. SPF/DKIM e-mail  
7. Crons backup/monitor  
8. KYC organizador + 1ª venda teste  

---

## Anexo C — Checklist de revisão manual

- [x] Home: hero + diferenciais + logo  
- [x] Navbar: busca  
- [x] Footer: sem links mortos  
- [x] Página evento: mapa, relacionados, urgência  
- [x] Checkout: badges; sem Stripe  
- [x] Vitrine: chips data + intervalo  
- [x] `/planos`: SVG; Sympla disclaimer; simulador  
- [x] Wizard + Financeiro: simuladores; split + saque Pix white-label  
- [x] Parcelamento 2/3/6/12x  
- [x] Lista interesse + espera  
- [x] `/produtor/{slug}`  
- [x] `/ajuda` + `/blog`  
- [x] Wallet “Em breve” + doc  
- [x] `/funcionalidades`: PNGs marketing  
- [x] Disclaimers legais em todos simuladores  
- [x] `pytest` + E2E  
- [ ] Go-live VPS completo — **Anexo B (usuário)**  
- [ ] Google Maps API — **Anexo A (sessão com usuário)**  
