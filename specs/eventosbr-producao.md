# Spec: EventosBR — Produção, produto e pagamentos

**Versão:** 1.3  
**Data:** 2026-07-22  
**Comando:** `/build` implementa; `/review` valida contra este arquivo.

> **Documento único** de referência para publicação do sistema. Substitui `repasse-asaas-pagamentos.md` e `patamar-completo-ux-produto.md`.
>
> **Produção (VPS):** `main` em `2d32122` — validado em 22/jul/2026 (`verify-production.sh`, `verificar-versao-site.sh`).

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
3. Backend provisiona a conta via API do processador (`POST /v3/accounts` — rota interna `POST /api/organizador/asaas/subconta`).
4. KYC/análise → status `approved` libera publicação e venda.
5. Repasses caem na conta de recebimento do organizador via split; **saques Pix** são solicitados na plataforma (white-label).
6. Extrato, vendas e conciliação na área **Financeiro** do organizador.

**Terminologia (UX e spec):** usar sempre **conta de recebimento** ou **conta de repasses**. Não expor “subconta”, “Asaas” nem “vincular wallet” ao usuário.

**Modo de produção obrigatório:** `ASAAS_ONBOARDING_MODE=baas` (único modo em produção).

### 2.3 Configuração Asaas — somente produção

Em **produção** (`ENVIRONMENT=production`):

| Variável | Valor fixo | Observação |
|----------|------------|------------|
| `ASAAS_ENVIRONMENT` | `production` | Chaves `$aact_prod_...`; **não alterar** para sandbox/homologação |
| `ASAAS_ONBOARDING_MODE` | `baas` | Conta de recebimento criada pela plataforma |
| `ASAAS_ALLOW_MANUAL_WALLET` | `false` | Sem colar walletId manualmente |
| `ASAAS_DISABLED` | `false` | Pagamentos reais ativos |

Credenciais Asaas (`ASAAS_API_KEY`, `ASAAS_PLATFORM_WALLET_ID`, `ASAAS_WEBHOOK_TOKEN`) são de **produção**, configuradas uma vez no `.env` do VPS e **não devem ser trocadas** em operação normal. Backups: `backup-prod-env.sh` / `restore-prod-env.sh`.

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

### 2.7 Testes pré-go-live

Homologação sandbox foi concluída internamente. Em produção não há alternância de ambiente.

**Teste automatizado mock (CI e VPS — não cobra de verdade):**

```bash
# Local
python3 -m pytest tests/test_compra_split_fluxo_mock.py -v

# VPS (pytest dentro do container)
bash scripts/test-compra-split-mock.sh
```

Valida: compra PIX mock → webhook → ingresso pago → split só no wallet do organizador (não da plataforma).

Conectividade com API real: `scripts/test-asaas-connection.py` + webhook configurado no painel do processador.

---

## 3. UX — Área da conta

- `ContaShell` em `/conta/*`: menu lateral **Perfil**, **Pagamentos**, **Ingressos**, **Notificações** (cliente).
- Dropdown do avatar: **Painel** (só organizador), **Perfil**, **Pagamentos**, **Ingressos**, **Notificações**, **Sair**.
- Organizador logado: dropdown aponta para `/organizador/perfil` e subrotas (`/pagamentos`, `/ingressos`, `/notificacoes`), renderizando os mesmos clients de `/conta/*` dentro do `OrganizadorShell` — a barra lateral **Painel** não muda.
- `/organizador/perfil/layout.tsx`: abas horizontais (Perfil · Pagamentos · Ingressos · Notificações) com links para as subrotas.
- `auth/layout.tsx` + `layout.tsx`: rodapé fixo no fim da viewport — shell estável (`grid` `auto 1fr auto` ou `flex` `min-h-dvh flex-col`), CSS crítico `eventosbr-shell-layout`, `EarlyScrollReset` no `<head>`. Validação: `scripts/verificar-versao-site.sh`.
- Máscaras: CPF/CNPJ, CEP, telefone nos formulários financeiro, checkout e repasse de ingresso.
- **White-label:** mensagens ao usuário não expõem o processador de pagamentos (`api-errors.ts`, `mensagens_publicas.py`). UI Financeiro fala em **conta de recebimento**, nunca em subconta ou Asaas.

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

**Fora do escopo desta publicação:** múltiplos operadores, formulário custom inscrição, importação CSV, certificados, PWA equipe, Apple/Google Wallet, NFSe automática, modo `linked`/`both`, sandbox Asaas.

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
| White-label pagamentos (sem marca do provedor) | `api-errors.ts`, `app/utils/mensagens_publicas.py` |

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

Checks: `production_checks.py` → `GET /api/admin/setup`. Em produção valida: `ASAAS_ENVIRONMENT=production`, `ASAAS_ONBOARDING_MODE=baas`, `ASAAS_ALLOW_MANUAL_WALLET=false`, senha Postgres, `CORS_ORIGINS` só HTTPS, `FRONTEND_PUBLIC_URL` preenchida (bloqueia `ready_for_production` se vazia).

---

## 7. Critérios de conclusão para publicação

### Pagamentos

- [x] Split só para organizador; taxa na conta emissora
- [x] Conta de recebimento criada pela plataforma (`ASAAS_ONBOARDING_MODE=baas`)
- [x] KYC → status `approved` libera venda e publicação
- [x] Bloqueio venda/publicação sem conta de recebimento aprovada
- [x] Extrato, vendas agrupadas, estornos, saque Pix white-label
- [x] Asaas somente produção no VPS (credenciais fixas, sem sandbox)

### UX conta e login

- [x] ContaShell lateral persistente (`/conta/*`)
- [x] Subrotas organizador `/organizador/perfil/*` (mesmos clients)
- [x] Dropdown organizador com Pagamentos/Ingressos/Notificações → subrotas
- [x] Abas horizontais em `/organizador/perfil/layout.tsx`
- [x] Rodapé estável (shell + `EarlyScrollReset` — validado no VPS)
- [x] Máscaras formulários
- [x] White-label: mensagens sanitizadas; UI usa conta de recebimento (sem subconta/Asaas expostos)

### Qualidade

- [x] `pytest` verde (217 testes)
- [x] `npm run build` verde
- [x] CI `api`, `web`, `e2e-compra`, `e2e-asaas` verdes
- [ ] CI `e2e` (smoke + patamar) verde
- [x] Teste mock compra + split: `scripts/test-compra-split-mock.sh`

### Operação (usuário no VPS)

- [x] `.env` produção preenchido (validado em `eventosbr.app.br` — 22/jul/2026)
- [x] VPS em `main` oficial (`2d32122` = `origin/main`)
- [x] `ASAAS_ENVIRONMENT=production` e `ASAAS_ONBOARDING_MODE=baas` confirmados
- [x] `verify-production.sh` sem falhas críticas
- [x] `verificar-versao-site.sh` — site atualizado
- [x] Testes mock split no VPS (2 passed)
- [x] `alembic upgrade head` (migração `20260717_000035`)
- [ ] Webhook configurado e testado com evento real (`PAYMENT_RECEIVED`)
- [ ] SMTP + SPF/DKIM validados (envio real de ingresso)
- [ ] Primeira venda real validada (PIX ou cartão + e-mail recebido)

---

## 8. Referência de arquivos

| Área | Arquivos |
|------|----------|
| Split / cobrança | `pagamento_asaas.py`, `pagamentos_asaas_handlers.py` |
| Conta de recebimento | `organizador_asaas.py`, `evento_repasse.py` |
| Financeiro | `financeiro_organizador.py`, `financeiro_conciliacao.py`, `saque_asaas.py` |
| UI financeiro | `organizador-repasses-painel.tsx` |
| Conta | `conta-shell.tsx`, `conta/layout.tsx`, `auth/layout.tsx`, `organizador/perfil/layout.tsx` |
| White-label | `api-errors.ts`, `mensagens_publicas.py` |
| Verificação deploy | `verificar-versao-site.sh`, `verify-production.sh` |
| Config | `config/settings.py`, `production_checks.py`, `.env.production.example` |
| Go-live ops | `docs/11-go-live-asaas.md`, `scripts/atualizar-vps-agora.sh`, `scripts/configure-asaas-env.sh` |
| Teste split mock | `tests/test_compra_split_fluxo_mock.py`, `scripts/test-compra-split-mock.sh` |
| Backup produção | `backup-prod-env.sh`, `verify-prod-backup.sh`, `restore-prod-env.sh` |

---

## 9. Extensões (não bloqueiam publicação)

Antecipação automática de cartão, cancelamento de saque, mock E2E (`ASAAS_E2E_MOCK`), scripts de setup de webhook, comprovante de transferência, backfill de ledger, modo `linked` legado (apenas dev).
