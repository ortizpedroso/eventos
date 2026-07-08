# 11 — Go-live com Asaas (produção)

Checklist operacional para publicar o EventosBR com **Asaas** como provedor de pagamento.

**Última atualização:** 17/06/2026

---

## 0. Testar no GitHub (antes do deploy no VPS)

Cada **pull request** dispara o CI (`.github/workflows/ci.yml`):

| Job | O que valida |
|-----|----------------|
| `api` | `pytest` — 122+ testes da API |
| `web` | `npm run build` do frontend |
| `e2e` | Playwright smoke (páginas principais) |
| `e2e-compra` | Stack Docker + compra com mock Asaas |
| `prod-compose` | `docker-compose.prod.yml` válido |

**Como ver:** abra o PR [#7](https://github.com/ortizpedroso/eventos/pull/7) → aba **Checks** (ou **Actions** no repositório).

**Localmente (sem VPS):**
```bash
python -m pytest tests/ -q
cd frontend && npm run build
./scripts/smoke-auditoria.sh
```

O CI **não faz deploy** para o VPS — produção continua manual com `./scripts/deploy-vps.sh`.

---

## Pré-requisitos

- VPS com Docker (≥ 2 GB RAM)
- Domínio com DNS apontando para o VPS
- Conta Asaas **produção** (`$aact_prod_...`)
- E-mail transacional (SMTP + SPF/DKIM)
- `walletId` da conta EventosBR no Asaas (split da taxa)

---

## 1. Variáveis de ambiente (`.env`)

Copie `.env.production.example` → `.env` e preencha:

| Variável | Obrigatório | Descrição |
|----------|-------------|-----------|
| `DOMAIN` | Sim | Domínio público |
| `PAYMENT_PROVIDER` | Sim | `asaas` |
| `ASAAS_API_KEY` | Sim | Chave produção |
| `ASAAS_WEBHOOK_TOKEN` | Sim | Token forte (header `asaas-access-token`) |
| `ASAAS_PLATFORM_WALLET_ID` | Sim | Wallet da plataforma para split |
| `ASAAS_ENVIRONMENT` | Sim | `production` |
| `SECRET_KEY` | Sim | ≥ 32 caracteres aleatórios |
| `EMAIL_USER` / `EMAIL_PASSWORD` | Sim | SMTP |
| `PLATFORM_ADMIN_API_KEY` | Sim | Painel `/admin` |
| `POSTGRES_PASSWORD` | Sim | Senha do Postgres |
| `CORS_ORIGINS` | Sim | URLs HTTPS do site (sem `*`) |
| `ASAAS_DISABLED` | Recomendado | `false` em produção; `true` só em dev/teste |

Gerar secrets: `./scripts/generate-secrets.sh`

---

## 2. Deploy

```bash
cd /opt/eventosbr
cp .env.production.example .env
nano .env
./scripts/deploy-vps.sh
```

A API executa `alembic upgrade head` automaticamente no arranque.

Migrações obrigatórias (head atual: `20260626_000033`):
- `20260617_000020` — colunas `asaas_*` em usuários, eventos, ingressos
- `20260617_000021` — subconta e antecipação do organizador
- `20260618_000022` — `stripe_events` → `webhook_events`
- `20260618_000023` — remove colunas Stripe; backfill wallet; refs legadas
- `20260618_000024` — cifra `asaas_subaccount_api_key` (não rotacione `SECRET_KEY` após go-live sem re-cifrar)
- `20260624_000031` — status de repasse (`asaas_repasse_status`, detalhes)
- `20260625_000032` — `pago_em`, campos saque Asaas (`asaas_transfer_id`)
- `20260626_000033` — `asaas_repasse_cpf_cnpj`, `estornado_em`

---

## 3. Webhook Asaas

**URL:** `https://SEU_DOMINIO/api/webhooks/asaas`

No painel Asaas → Integrações → Webhooks:
- Token = valor de `ASAAS_WEBHOOK_TOKEN` no `.env`
- Eventos pagamento: `PAYMENT_RECEIVED`, `PAYMENT_CONFIRMED`, `PAYMENT_REFUNDED`, `PAYMENT_OVERDUE`, `PAYMENT_DELETED`, `PAYMENT_CHARGEBACK_*`
- Eventos conta: `ACCOUNT_STATUS_GENERAL_APPROVAL_*`, `ACCOUNT_STATUS_COMMERCIAL_INFO_*`, `ACCOUNT_STATUS_DOCUMENT_*`, `ACCOUNT_STATUS_BANK_ACCOUNT_INFO_*`
- Transferências (saques): `TRANSFER_CREATED`, `TRANSFER_PENDING`, `TRANSFER_IN_BANK_PROCESSING`, `TRANSFER_DONE`, `TRANSFER_FAILED`, `TRANSFER_CANCELLED`

Subcontas criadas pela plataforma recebem webhooks automaticamente no `POST /v3/accounts` quando `FRONTEND_PUBLIC_URL` e `ASAAS_WEBHOOK_TOKEN` estão configurados.

Referência: `./scripts/asaas-webhook-setup.sh SEU_DOMINIO.com.br`

---

## 3.1 Transferências sem token SMS (BaaS white-label)

Para saques automatizados via API **sem aprovação manual/SMS** no painel Asaas, combine **duas** camadas (recomendado pelo Asaas):

### A) IP fixo na whitelist (conta raiz BaaS)

1. Alinhar com o **gerente de contas Asaas** o modelo BaaS e liberação de subcontas.
2. Configurar **NAT/egress IP fixo** no VPS (Hostinger ou cloud).
3. Painel Asaas → **Integrações → Mecanismos de segurança** → **Lista de IPs autorizados**:
   - Adicionar o IP público de saída da API.
   - Em **Evento crítico em requisições de saque**: **Desabilitado** para esse IP (processamento automático).
4. Subcontas **herdam** a configuração da conta raiz.

Documentação: [IP Whitelisting](https://docs.asaas.com/docs/ip-whitelisting)

### B) Webhook de autorização de saque (obrigatório se desabilitar evento crítico)

**URL:** `https://SEU_DOMINIO/api/webhooks/asaas/transfer-auth`

Painel Asaas → **Integrações → Mecanismos de segurança** → **Autorização de saque via Webhook**:

| Campo | Valor |
|-------|--------|
| URL | `https://SEU_DOMINIO/api/webhooks/asaas/transfer-auth` |
| Token | Mesmo `ASAAS_WEBHOOK_TOKEN` do `.env` (header `asaas-access-token`) |
| E-mail de erro | E-mail ops da plataforma |

Fluxo:

1. Organizador solicita saque → API grava `FinanceiroSaque` e chama `POST /v3/transfers`.
2. ~5s depois o Asaas envia POST com `type: TRANSFER` e objeto `transfer`.
3. A API valida `id` / `externalReference` e valor contra o saque e responde `{"status": "APPROVED"}` ou `REFUSED`.
4. Se falhar 3 vezes ou não responder, o Asaas **cancela** a transferência.

Documentação: [Validação de saques via webhook](https://docs.asaas.com/docs/mechanism-for-validating-withdrawals-via-webhooks)

Script de referência: `./scripts/asaas-transfer-auth-setup.sh SEU_DOMINIO.com.br`

---

## 3.2 Testes sandbox no VPS (produção com credenciais de homologação)

Para validar PIX/cartão real no ambiente `eventosbr.app.br` **sem** perder as credenciais de produção:

### Fluxo recomendado

```bash
cd /opt/eventosbr

# 1. Deploy da branch em teste (ou main após merge do PR)
./scripts/atualizar-vps-branch.sh cursor/ux-seo-melhorias-v2-bf71
# — ou, após merge: ./scripts/atualizar-vps-agora.sh

# 2. Guardar credenciais de produção
./scripts/backup-asaas-prod-env.sh

# 3. Alternar para sandbox (interativo ou via arquivo pendente)
cp .env.asaas-sandbox-pending.example .env.asaas-sandbox-pending
nano .env.asaas-sandbox-pending   # preencher $aact_hmlg_... e walletId sandbox
./scripts/switch-asaas-sandbox.sh --reload

# 4. Webhook no painel Asaas SANDBOX (não o de produção)
./scripts/asaas-webhook-setup.sh eventosbr.app.br

# 5. Vitrine profissional (opcional)
python3 scripts/seed-vitrine-profissional.py

# 6. Testes manuais: compra PIX/cartão em valor baixo, confirmação de ingresso

# 7. Restaurar produção
./scripts/restore-asaas-prod-env.sh --reload
```

### Scripts

| Script | Função |
|--------|--------|
| `backup-asaas-prod-env.sh` | Grava `.env.asaas-prod-backup` (gitignored) |
| `switch-asaas-sandbox.sh` | Backup + `ASAAS_ENVIRONMENT=sandbox` + chaves sandbox |
| `restore-asaas-prod-env.sh` | Restaura backup; `--reload` reinicia a API |
| `atualizar-vps-branch.sh` | Deploy de branch específica (sem reset para main) |

**Importante:** o webhook de sandbox e o de produção são contas separadas no Asaas. Configure o webhook na conta **sandbox** com a mesma URL pública (`https://SEU_DOMINIO/api/webhooks/asaas`) e o mesmo `ASAAS_WEBHOOK_TOKEN` do `.env`.

---

## 4. Organizadores — repasses

Antes de vender ingressos pagos, cada organizador deve:
1. Aceder **Organizador → Financeiro**
2. **Criar conta de repasses** (subconta Asaas — dados validados pelo Asaas)
3. Aguardar aprovação em `/organizador/financeiro/conta-repasse`
4. Confirmar status **Conta aprovada**

Em produção, colar `walletId` manualmente está desativado (`ASAAS_ALLOW_MANUAL_WALLET=false`).

Sem repasse aprovado, publicação de eventos pagos e checkout retornam erro.

Organizadores sacam via **Financeiro → Solicitar transferência Pix** (carência 48h após confirmação de cada venda). Não é necessário acessar o painel Asaas.

---

## 5. Verificação pós-deploy

```bash
./scripts/verify-production.sh
```

Manual:
- `curl -fsS https://SEU_DOMINIO/health`
- `curl -fsS https://SEU_DOMINIO/ready`
- `/admin/dashboard` → aba **Produção** (todos os checks verdes)
- Compra teste: PIX ou cartão em valor baixo
- E-mail de ingresso recebido

---

## 6. Monitoramento

- Health: `GET /health` (liveness)
- Readiness: `GET /ready` (inclui Postgres)
- Caddy expõe `/health` e `/ready` diretamente na API
- Logs: `docker compose -f docker-compose.prod.yml logs -f api web caddy`
- Backup diário: cron com `./scripts/backup-postgres-cron.sh` (rotação 14 dias por padrão)
- Alerta `/ready`: `./scripts/monitor-ready.sh` no cron (webhook ou e-mail via `.env`)

---

## 7. Credenciais Asaas (quando tiver acesso ao painel)

```bash
./scripts/configure-asaas-env.sh
# ou não interativo:
./scripts/configure-asaas-env.sh \
  --api-key '$aact_prod_...' \
  --platform-wallet 'SEU_WALLET_ID' \
  --webhook-token 'token-forte'
./scripts/deploy-vps.sh
./scripts/verify-production.sh
```

---

## 8. Checkout — métodos disponíveis

| Método | UX |
|--------|-----|
| **PIX** | QR + copia e cola; confirmação via webhook |
| **Cartão** | Formulário transparente (dados vão direto ao Asaas) |
| **Fatura** | Redirect para página Asaas (boleto/cartão/PIX) |

---

## 9. Rollback / contingência

- `ASAAS_DISABLED=true` — desativa cobranças (modo manutenção)
- Restaurar DB: `./scripts/restore-postgres.sh`

---

## Referências

- `docs/08-deploy-hostinger.md` — VPS e Caddy
- `docs/06-configuracao-operacao.md` — operação geral
- `docs/10-checklist-proximo-patamar.md` — roadmap produto
