# Spec: EventosBR — Produção, produto e pagamentos

**Versão:** 1.6  
**Data:** 2026-07-22  
**Comando:** `/build` implementa; `/review` valida contra este arquivo.

> **Documento único** de referência para publicação do sistema. Substitui `repasse-asaas-pagamentos.md` e `patamar-completo-ux-produto.md`.
>
> **Produção (VPS):** `main` em `df3942c` (PR #43). **PR #44** (conta de recebimento PF/PJ) aguardando merge. **Deploy VPS:** após merge → `bash scripts/atualizar-vps-agora.sh`. **Bloqueio pagamentos:** conta mãe Asaas precisa ser **CNPJ** (usuário vai configurar). **Testes reais (§2.8):** após CNPJ + deploy PR #44.

---

## 1. Objetivo

Publicar o EventosBR (`eventosbr.app.br`) como plataforma de ingressos com:

- Pagamentos integrados (PIX, cartão, boleto) — processador **Asaas** em produção, **invisível ao usuário final**
- Repasse automático ao organizador via **split**
- Cada organizador possui **conta de recebimento** criada e gerida **pela plataforma** (sem conta Asaas separada, sem “subconta” exposta na UX)
- UX de compra, conta, organizador e portaria em nível de mercado
- Segurança e configuração prontas para **produção**

**Marca:** EventosBR · **Domínio:** `eventosbr.app.br`

---

## 2. Pagamentos e repasse

### 2.1 Split na venda

| Destino | O que recebe | Como |
|---------|----------------|------|
| Organizador | Preço − taxa EventosBR − descontos | `split[].walletId` = wallet da **conta de recebimento** do organizador |
| Plataforma | Taxa EventosBR (% + fixo) | Permanece na conta emissora EventosBR (fora do `split`) |
| Processador | Taxas do gateway | Fora do split |

Implementação: `app/services/pagamento_asaas.py` → `split_para_evento()`.

Ledger por ingresso: `financeiro_organizador.py` → `registrar_ledger_ingressos_lote()`.

### 2.2 Conta de recebimento do organizador (modelo de produção)

**O organizador não cria nem vincula conta em painel externo.** Tudo ocorre dentro do EventosBR:

1. Organizador → **Financeiro** → **Criar conta de recebimento**.
2. Formulário na plataforma (CPF/CNPJ, endereço, telefone, renda, data de nascimento quando PF).
3. Backend provisiona a **conta de recebimento** do organizador (PF ou PJ) via API do processador (`POST /v3/accounts` — rota pública `POST /api/organizador/asaas/conta-recebimento`; alias legado `/asaas/subconta`).
4. KYC/análise → status `approved` libera publicação e venda.
5. Repasses caem na conta de recebimento do organizador via split; **saques Pix** são solicitados na plataforma (white-label).
6. Extrato, vendas e conciliação na área **Financeiro** do organizador.

**Conta mãe da plataforma (operação):** a chave `ASAAS_API_KEY` do EventosBR deve pertencer a uma conta **pessoa jurídica (CNPJ)** no processador. Sem isso, o provisionamento de contas de recebimento dos organizadores é bloqueado pelo processador (limitação BaaS). Organizadores podem ser **PF (CPF)** ou **PJ (CNPJ)** — o bloqueio não é do CPF do organizador, e sim da conta mãe da plataforma.

**Terminologia (UX e spec):** usar sempre **conta de recebimento** ou **conta de repasses**. Não expor “subconta”, “Asaas” nem “vincular wallet” ao usuário.

**Acompanhamento dinâmico (tracker):** após criar conta ou iniciar assinatura, UI exibe stepper com polling (`GET /api/organizador/onboarding/conta/{trackingId}/status` e `GET /api/organizador/onboarding/assinatura/{subscriptionId}/status`, intervalo ~4s). E-mails automáticos no backend em `APPROVED`/`REJECTED` (conta) e `SUBSCRIBED`/`PAYMENT_FAILED` (assinatura). Componente reutilizável: `frontend/src/components/status-tracker.tsx`.

**Modo de produção obrigatório:** `ASAAS_ONBOARDING_MODE=baas` (único modo em produção).

### 2.3 Configuração Asaas — somente produção

Em **produção** (`ENVIRONMENT=production`):

| Variável | Valor fixo | Observação |
|----------|------------|------------|
| `ASAAS_ENVIRONMENT` | `production` | Chaves `$aact_prod_...`; **não alterar** |
| `ASAAS_ONBOARDING_MODE` | `baas` | Conta de recebimento criada pela plataforma |
| `ASAAS_ALLOW_MANUAL_WALLET` | `false` | Sem colar walletId manualmente |
| `ASAAS_DISABLED` | `false` | Pagamentos reais ativos |

A conta Asaas vinculada a `ASAAS_API_KEY` deve ser **CNPJ** (conta mãe da plataforma) para provisionar contas de recebimento dos organizadores. Verificação: `GET /api/admin/setup` → `checks.asaas_platform_cnpj`.

Credenciais Asaas (`ASAAS_API_KEY`, `ASAAS_PLATFORM_WALLET_ID`, `ASAAS_WEBHOOK_TOKEN`) são de **produção**, configuradas uma vez no `.env` do VPS e **não devem ser trocadas** em operação normal. Backups: `backup-prod-env.sh` / `restore-prod-env.sh`.

`config/settings.py` → com `ENVIRONMENT=production`, `asaas_env()` retorna sempre `production` (sem inferência sandbox).

Modos `linked` e `both` existem apenas no código para desenvolvimento legado — **fora do escopo de produção** e desta spec.

### 2.4 Status que liberam venda

`app/services/evento_repasse.py` → em produção: **`approved`** (conta de recebimento aprovada).

Status `manual` e `linked` aplicam-se só a ambientes de desenvolvimento com flags explícitas — não usados em produção.

### 2.5 Checkout e assinatura

- Checkout bloqueado sem conta de recebimento aprovada.
- Webhooks `PAYMENT_*` marcam `pago_em`.
- Assinatura mensal: 100% plataforma, sem split de ingresso; reutiliza PIX pendente.

### 2.6 Webhooks (produção)

- URL: `https://eventosbr.app.br/api/webhooks/asaas`
- Header: `asaas-access-token` = `ASAAS_WEBHOOK_TOKEN`
- Pagamentos: `PAYMENT_*`
- Conta de recebimento / saques: `ACCOUNT_STATUS_*`
- Autorização de transferência Pix: `https://eventosbr.app.br/api/webhooks/asaas/transfer-auth`

### 2.7 Testes automatizados (código — não cobram de verdade)

```bash
# Local — suite completa
python3 -m pytest -q

# Local — split mock
python3 -m pytest tests/test_compra_split_fluxo_mock.py -v

# VPS (pytest dentro do container)
bash scripts/test-compra-split-mock.sh

# Frontend
cd frontend && npm run build
cd frontend && npm run test:e2e          # smoke + patamar (sem API)
```

Valida: compra PIX mock → webhook → ingresso pago → split só no wallet do organizador (não da plataforma).

**CI** (`.github/workflows/ci.yml`):

| Job | O que valida |
|-----|----------------|
| `api` | `pytest` (241 testes) |
| `web` | `npm run build` |
| `e2e` | Playwright smoke + patamar **sem API** (`PLAYWRIGHT_SKIP_API_CHECK=1`) |
| `e2e-compra` | Stack Docker + compra mock + patamar com API (lista interesse, espera, produtor, perfil organizador) |
| `e2e-asaas` | Checkout PIX/cartão mock Asaas |
| `prod-compose` | `docker-compose.prod.yml` válido |

Conectividade API real (produção): `scripts/test-asaas-connection.py`.

### 2.8 Validação operacional (VPS — cobra de verdade)

Procedimentos para marcar os critérios §7 como concluídos **após merge do PR #42**:

#### A) Webhook real (`PAYMENT_RECEIVED`)

1. Painel Asaas → Integrações → Webhooks → URL `https://eventosbr.app.br/api/webhooks/asaas`
2. Token = `ASAAS_WEBHOOK_TOKEN` do `.env` (header `asaas-access-token`)
3. Eventos: `PAYMENT_*`, `ACCOUNT_STATUS_*`
4. No VPS: `bash scripts/test-asaas-webhook.sh --expect-ok` (valida token e URL)
5. Realizar compra de teste (PIX ou cartão) e confirmar no log da API que `PAYMENT_RECEIVED` atualizou `pago_em`

**Script (pré-check automatizado):** `bash scripts/validar-go-live-vps.sh --webhook-only`

#### B) SMTP + SPF/DKIM

1. Confirmar `EMAIL_USER`, `EMAIL_PASSWORD`, `EMAIL_SERVER` no `.env`
2. Compra de teste → e-mail de ingresso recebido na caixa de entrada (não spam)
3. Validar SPF/DKIM do domínio remetente (painel DNS / ferramenta do provedor)

#### C) Primeira venda real

1. Organizador com conta de recebimento `approved`
2. Evento publicado com ingresso pago
3. Compra PIX ou cartão concluída
4. Ingresso com QR na conta do comprador + e-mail recebido
5. Split visível no extrato Financeiro do organizador

---

## 3. UX — Área da conta

- `ContaShell` em `/conta/*`: menu lateral **Perfil**, **Pagamentos**, **Ingressos**, **Notificações** (cliente).
- Dropdown do avatar: **Painel** (só organizador), **Perfil**, **Pagamentos**, **Ingressos**, **Notificações**, **Sair**.
- Organizador logado: dropdown aponta para `/organizador/perfil` e subrotas (`/pagamentos`, `/ingressos`, `/notificacoes`), renderizando os mesmos clients de `/conta/*` dentro do `OrganizadorShell` — a barra lateral **Painel** não muda.
- Abas horizontais do perfil do organizador via `PerfilTabs` (`frontend/src/components/perfil-tabs.tsx`), renderizadas abaixo do título em cada página `/organizador/perfil/*` (Perfil · Pagamentos · Ingressos · Notificações). O `layout.tsx` do perfil é passthrough.
- `auth/layout.tsx` + `layout.tsx`: rodapé fixo no fim da viewport — shell estável (`grid` `auto 1fr auto`), CSS crítico `eventosbr-shell-layout`, `EarlyScrollReset` no `<head>`. Validação: `scripts/verificar-versao-site.sh`.
- Máscaras: CPF/CNPJ, CEP, telefone nos formulários financeiro, checkout e repasse de ingresso.
- **White-label:** mensagens ao usuário não expõem o processador de pagamentos:
  - `api-errors.ts` e `mensagens_publicas.py` — sanitização de erros API
  - `organizador-repasses-painel.tsx` — copy “conta de recebimento/repasses”
  - `documentacao/page.tsx` e `documentacao/api/page.tsx` — sem `wallet_id`, paths sanitizados na UI
  - `scripts/export-openapi.py` — summaries/descriptions sem marca do provedor em `openapi.json`

---

## 4. UX — Produto (checklist publicação)

| # | Requisito | Status |
|---|-----------|--------|
| P1 | Logo, hero, diferenciais, busca navbar, footer profissional | [x] |
| P2 | Checkout all-in sem marca do gateway; badges PIX/cartão/seguro | [x] |
| P3 | Vitrine: filtros data, mapa evento, urgência, relacionados | [x] |
| P4 | Planos unificados, simuladores organizador/comprador | [x] |
| P5 | Parcelamento 2/3/6/12x; lista interesse e espera | [x] |
| P6 | Página pública organizador `/produtor/{slug}` | [x] |
| P7 | Central `/ajuda`, blog, documentação API | [x] |
| P8 | Wizard evento 3 passos, checklist publicação, tour organizador | [x] |
| P9 | Portaria: QR local, feedback som/vibração, rate limit | [x] |
| P10 | SEO: sitemap, robots, metadata | [x] |

**Fora do escopo desta publicação:** múltiplos operadores, formulário custom inscrição, importação CSV, certificados, PWA equipe, Apple/Google Wallet, NFSe automática, modo `linked`/`both`, sandbox Asaas em produção.

---

## 5. Segurança

| Item | Onde |
|------|------|
| Proxy admin só via cookie | `api/admin/proxy` |
| Middleware sessão + CSP nonce | `middleware.ts`, `csp.ts` |
| Verificação e-mail compra rápida | `email_verificacao.py` |
| Rotação token portaria | `evento_portaria.py` |
| Rate limit portaria | `rate_limit.py` |
| Mensagens API em português | `api-errors.ts` |
| White-label pagamentos (sem marca do provedor) | `api-errors.ts`, `mensagens_publicas.py`, `documentacao/api/page.tsx` |

---

## 6. Variáveis de ambiente (produção)

| Variável | Obrigatório | Valor em produção |
|----------|-------------|-------------------|
| `ASAAS_API_KEY` | Sim | Chave `$aact_prod_...` — **não alterar** |
| `ASAAS_PLATFORM_WALLET_ID` | Sim | Wallet da plataforma — **não alterar** |
| `ASAAS_WEBHOOK_TOKEN` | Sim | Token do webhook — **não alterar** |
| `ASAAS_ENVIRONMENT` | Sim | **`production`** (fixo) |
| `ASAAS_ONBOARDING_MODE` | Sim | **`baas`** (fixo) |
| `ASAAS_ALLOW_MANUAL_WALLET` | Sim | **`false`** (fixo) |
| `ASAAS_DISABLED` | Sim | **`false`** |
| `SECRET_KEY` | Sim (≥ 32 chars) | |
| `EMAIL_USER` / `EMAIL_PASSWORD` | Sim | |
| `PLATFORM_ADMIN_API_KEY` | Sim | |
| `CORS_ORIGINS` | HTTPS, sem `*` | |
| `FRONTEND_PUBLIC_URL` | URL pública | |
| `POSTGRES_PASSWORD` | Sim | |

Checks: `production_checks.py` → `GET /api/admin/setup`. Em produção valida:

- `ASAAS_ENVIRONMENT=production`
- `ASAAS_ONBOARDING_MODE=baas`
- `ASAAS_ALLOW_MANUAL_WALLET=false`
- `ASAAS_DISABLED=false` (check `asaas_payments_enabled`)
- Conta mãe Asaas **CNPJ** em modo `baas` (check `asaas_platform_cnpj`)
- Senha Postgres, `CORS_ORIGINS` só HTTPS, `FRONTEND_PUBLIC_URL` preenchida

Bloqueia `ready_for_production` se qualquer check crítico estiver `pendente`.

---

## 7. Critérios de conclusão para publicação

### Pagamentos (código)

- [x] Split só para organizador; taxa na conta emissora
- [x] Conta de recebimento criada pela plataforma (`ASAAS_ONBOARDING_MODE=baas`)
- [x] Organizador PF ou PJ — rotas `conta-recebimento`; sem “subconta” na UX (PR #44)
- [x] Pré-check conta mãe CNPJ + mensagem clara se plataforma PF (`asaas_plataforma.py`)
- [x] KYC → status `approved` libera venda e publicação
- [x] Bloqueio venda/publicação sem conta de recebimento aprovada
- [x] Extrato, vendas agrupadas, estornos, saque Pix white-label
- [x] Asaas somente produção no VPS (credenciais fixas; `asaas_env()` força production)

### UX conta e login (código)

- [x] ContaShell lateral persistente (`/conta/*`)
- [x] Subrotas organizador `/organizador/perfil/*` (mesmos clients)
- [x] Dropdown organizador com Pagamentos/Ingressos/Notificações → subrotas
- [x] Abas horizontais via `PerfilTabs` em `/organizador/perfil/*` (validado em produção)
- [x] Rodapé estável (shell + `EarlyScrollReset` — validado no VPS)
- [x] Máscaras formulários
- [x] White-label: mensagens sanitizadas; UI usa conta de recebimento (sem subconta/Asaas expostos)

### Qualidade (código + CI)

- [x] `pytest` verde (237 testes)
- [x] `npm run build` verde
- [ ] CI `api`, `web`, `e2e`, `e2e-compra`, `e2e-asaas` verdes no PR #44
- [x] Teste mock compra + split: `scripts/test-compra-split-mock.sh`
- [x] OpenAPI exportado sem paths `subconta` (`export-openapi.py` white-label)
- [x] API status usa só `tem_conta_recebimento` / `permite_conta_recebimento` (sem aliases legados)
- [x] Checkout: código `repasse` + aviso proativo antes do pagamento (`compra_indisponivel_codigo`)

### Operação (VPS — após merge PR #44 + CNPJ Asaas)

**Estado do repositório:**

- [x] PR #42 e #43 mergeados em `main`
- [ ] PR #44 mergeado (`cursor/conta-recebimento-pf-pj-bf71`)
- [ ] Conta mãe Asaas em **CNPJ** + `ASAAS_API_KEY` / `ASAAS_PLATFORM_WALLET_ID` atualizados
- [ ] Deploy VPS: `cd /opt/eventosbr && bash scripts/atualizar-vps-agora.sh`
- [ ] `GET /api/admin/setup` → `asaas_platform_cnpj: ok`

**Validado anteriormente no VPS (`df3942c`):**

- [x] `.env` produção preenchido
- [x] `ASAAS_ENVIRONMENT=production` e `ASAAS_ONBOARDING_MODE=baas`
- [x] `verify-production.sh` / `verificar-versao-site.sh`
- [x] Webhook token HTTP 200 (`test-asaas-webhook.sh --expect-ok`) — revalidar após trocar conta Asaas

**Pendente — testes reais (§2.8) — após CNPJ e deploy:**

```bash
cd /opt/eventosbr && bash scripts/validar-go-live-vps.sh
```

- [ ] Webhook configurado e testado com evento real (`PAYMENT_RECEIVED`) — §2.8 A
- [ ] SMTP + SPF/DKIM validados (envio real de ingresso) — §2.8 B
- [ ] Primeira venda real validada (PIX ou cartão + e-mail recebido) — §2.8 C

---

## 8. Referência de arquivos

| Área | Arquivos |
|------|----------|
| Split / cobrança | `pagamento_asaas.py`, `pagamentos_asaas_handlers.py` |
| Conta de recebimento | `organizador_asaas.py`, `asaas_plataforma.py`, `evento_repasse.py` |
| Financeiro | `financeiro_organizador.py`, `financeiro_conciliacao.py`, `saque_asaas.py` |
| UI financeiro | `organizador-repasses-painel.tsx` |
| Conta / perfil | `conta-shell.tsx`, `perfil-tabs.tsx`, `conta/layout.tsx`, `organizador/perfil/layout.tsx` |
| White-label | `api-errors.ts`, `mensagens_publicas.py`, `documentacao/api/page.tsx`, `export-openapi.py` |
| Verificação deploy | `verificar-versao-site.sh`, `verify-production.sh` |
| Config / checks | `config/settings.py`, `production_checks.py`, `.env.production.example` |
| Go-live ops | `docs/11-go-live-asaas.md`, `atualizar-vps-agora.sh`, `configure-asaas-env.sh` |
| Testes | `test_compra_split_fluxo_mock.py`, `test-compra-split-mock.sh`, `test-asaas-webhook.sh`, `test-asaas-connection.py`, `validar-go-live-vps.sh` |
| CI | `.github/workflows/ci.yml` |
| Backup produção | `backup-prod-env.sh`, `verify-prod-backup.sh`, `restore-prod-env.sh` |

---

## 9. Extensões (não bloqueiam publicação)

Antecipação automática de cartão, cancelamento de saque, mock E2E (`ASAAS_E2E_MOCK`), scripts de setup de webhook, comprovante de transferência, backfill de ledger, modo `linked` legado (apenas dev).
