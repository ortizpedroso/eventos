# Spec: EventosBR — Produção, produto e pagamentos

**Versão:** 1.1  
**Data:** 2026-07-20  
**Comando:** `/build` implementa; `/review` valida contra este arquivo.

> **Documento único** de referência para publicação do sistema. Substitui `repasse-asaas-pagamentos.md` e `patamar-completo-ux-produto.md`.

---

## 1. Objetivo

Publicar o EventosBR (`eventosbr.app.br`) como plataforma de ingressos com:

- Pagamentos via **Asaas** (PIX, cartão, boleto)
- Repasse automático ao organizador via **split**
- UX de compra, conta, organizador e portaria em nível de mercado
- Segurança e configuração prontas para **produção**

**Marca:** EventosBR · **Domínio:** `eventosbr.app.br`

---

## 2. Pagamentos e repasse Asaas

### 2.1 Split na venda

| Destino | O que recebe | Como |
|---------|----------------|------|
| Organizador | Preço − taxa EventosBR − descontos | `split[].walletId` = wallet do organizador |
| Plataforma | Taxa EventosBR (% + fixo) | Permanece na conta emissora (fora do `split`) |
| Asaas | Taxas gateway | Fora do split |

Implementação: `app/services/pagamento_asaas.py` → `split_para_evento()`.

Ledger por ingresso: `financeiro_organizador.py` → `registrar_ledger_ingressos_lote()`.

### 2.2 Modos de conta do organizador (`ASAAS_ONBOARDING_MODE`)

| Modo | Padrão | Onboarding | Saques |
|------|--------|------------|--------|
| `baas` | **Sim** | Subconta via `POST /v3/accounts` | White-label na plataforma (Pix) |
| `linked` | Não | Vincular `walletId` da conta Asaas própria | No painel Asaas do organizador |
| `both` | Não | Ambos disponíveis | Conforme tipo ativo |

### 2.3 Modo linked (produção)

1. Organizador obtém `walletId` no painel Asaas.
2. Financeiro → **Vincular conta Asaas** → `PUT /api/organizador/asaas/wallet`.
3. Validação: formato UUID; diferente de `ASAAS_PLATFORM_WALLET_ID`; opcionalmente chave API do organizador para conferir `GET /v3/myAccount`.
4. Status `linked` libera publicação e venda.
5. Extrato e vendas na plataforma; saque no Asaas do organizador.

### 2.4 Modo BaaS (opcional)

- `POST /api/organizador/asaas/subconta` → KYC → status `approved`.
- Saque Pix white-label, carência 48h, conciliação ledger vs saldo subconta.
- Webhooks `ACCOUNT_STATUS_*`, transfer-auth §2.7.

### 2.5 Status que liberam venda

`app/services/evento_repasse.py` → `linked` | `approved` | `manual` (só dev com flag).

### 2.6 Checkout e assinatura

- Checkout bloqueado sem repasse configurado.
- Webhooks `PAYMENT_*` marcam `pago_em`.
- Assinatura mensal: 100% plataforma, sem split de ingresso; reutiliza PIX pendente.

### 2.7 Webhooks produção

- URL: `https://DOMINIO/api/webhooks/asaas`
- Header: `asaas-access-token` = `ASAAS_WEBHOOK_TOKEN`
- Pagamentos: `PAYMENT_*`
- Conta/saques: modo BaaS apenas
- Transfer-auth (BaaS): `https://DOMINIO/api/webhooks/asaas/transfer-auth`

### 2.8 Testes pré-go-live

Testes sandbox reais foram concluídos internamente. Os scripts de alternância sandbox foram removidos do repositório (commit `9149828`).

**Teste automatizado mock (CI e VPS):**

```bash
# Local
python3 -m pytest tests/test_compra_split_fluxo_mock.py -v

# VPS (pytest dentro do container — não use python3 na raiz do servidor)
bash scripts/test-sandbox-compra-split.sh
```

Valida: compra PIX mock → webhook → ingresso pago → split só no wallet do organizador (não da plataforma).

Para ambiente novo com API Asaas real: `scripts/test-asaas-connection.py` + webhook no painel.
---

## 3. UX — Área da conta

- `ContaShell` em `/conta/*`: menu lateral **Perfil**, **Pagamentos**, **Ingressos**, **Notificações**.
- Sem link “Painel” no menu da conta.
- Dropdown do avatar: Painel (só organizador), Perfil, Sair.
- `/organizador/perfil` (e subrotas) → redirect 308 para `/conta/*` (`next.config.ts`); navbar e painel apontam para `/conta/perfil`.
- `auth/layout.tsx` + `layout.tsx`: rodapé fixo no fim da viewport (flex shell, CSS crítico `eventosbr-shell-layout`, `EarlyScrollReset` no `<head>`).
- Máscaras: CPF/CNPJ, CEP, telefone nos formulários financeiro, checkout e repasse de ingresso.

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

**Fora do escopo desta publicação:** múltiplos operadores, formulário custom inscrição, importação CSV, certificados, PWA equipe, Apple/Google Wallet, NFSe automática.

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

---

## 6. Variáveis de ambiente (produção)

| Variável | Obrigatório |
|----------|-------------|
| `ASAAS_API_KEY` | Sim |
| `ASAAS_PLATFORM_WALLET_ID` | Sim |
| `ASAAS_WEBHOOK_TOKEN` | Sim |
| `ASAAS_ENVIRONMENT` | `production` |
| `ASAAS_ONBOARDING_MODE` | `baas` (padrão) ou `linked` / `both` |
| `SECRET_KEY` | Sim (≥ 32 chars) |
| `EMAIL_USER` / `EMAIL_PASSWORD` | Sim |
| `PLATFORM_ADMIN_API_KEY` | Sim |
| `CORS_ORIGINS` | HTTPS, sem `*` |
| `FRONTEND_PUBLIC_URL` | URL pública |
| `POSTGRES_PASSWORD` | Sim |
| `ASAAS_ALLOW_MANUAL_WALLET` | `false` |

Checks: `production_checks.py` → `GET /api/admin/setup`. Em produção valida também: `ASAAS_ENVIRONMENT=production`, `ASAAS_ONBOARDING_MODE` válido, `ASAAS_ALLOW_MANUAL_WALLET=false`, senha Postgres (via `DATABASE_URL`) e `CORS_ORIGINS` só HTTPS.

---

## 7. Critérios de conclusão para publicação

### Pagamentos

- [x] Split só para organizador; taxa na conta emissora
- [x] Modo linked: `PUT /asaas/wallet`, status `linked`, UI vínculo
- [x] Validação wallet: formato, ≠ plataforma, opcional API key organizador (`GET /v3/myAccount`)
- [x] Bloqueio venda/publicação sem repasse
- [x] Extrato, vendas agrupadas, estornos
- [x] Modo BaaS completo (quando `baas` ou `both`)

### UX conta e login

- [x] ContaShell lateral persistente
- [x] Rodapé login corrigido
- [x] Máscaras formulários

### Qualidade

- [x] `pytest` verde (208 testes em `main`; branch go-live inclui mock split)
- [x] `npm run build` verde
- [x] CI (api, web, e2e)
- [x] Teste mock compra + split: `scripts/test-sandbox-compra-split.sh`

### Operação (usuário no VPS)

- [x] `.env` produção preenchido (validado em `eventosbr.app.br` — jul/2026)
- [ ] Webhook Asaas configurado e testado com evento real (`PAYMENT_RECEIVED`)
- [x] Testes mock split no VPS (`test-sandbox-compra-split.sh` — 2 passed)
- [ ] SMTP + SPF/DKIM validados (envio real de ingresso)
- [x] `alembic upgrade head` (migração `20260717_000035` no deploy)
- [ ] Primeira venda real validada (PIX ou cartão + e-mail recebido)
- [ ] Merge PR #39 (`cursor/fix-footer-flash-bf71`) na `main` e VPS em `main` oficial

---

## 8. Referência de arquivos

| Área | Arquivos |
|------|----------|
| Split / cobrança | `pagamento_asaas.py`, `pagamentos_asaas_handlers.py` |
| Repasse / wallet | `organizador_asaas.py`, `evento_repasse.py` |
| Financeiro | `financeiro_organizador.py`, `financeiro_conciliacao.py`, `saque_asaas.py` |
| UI financeiro | `organizador-repasses-painel.tsx` |
| Conta | `conta-shell.tsx`, `conta/layout.tsx`, `auth/layout.tsx` |
| Config | `config/settings.py`, `production_checks.py` |
| Go-live ops | `docs/11-go-live-asaas.md`, `scripts/atualizar-vps-agora.sh`, `scripts/verify-production.sh` |
| Teste split mock | `tests/test_compra_split_fluxo_mock.py`, `scripts/test-sandbox-compra-split.sh` |
| Backup produção Asaas | `backup-prod-env.sh`, `verify-prod-backup.sh`, `restore-asaas-prod-env.sh`, `sync-asaas-prod-from-backup.sh` |

---

## 9. Extensões (não bloqueiam publicação)

Antecipação cartão subconta, cancelamento saque, mock E2E (`ASAAS_E2E_MOCK`), scripts webhook setup, comprovante transferência, backfill ledger.
