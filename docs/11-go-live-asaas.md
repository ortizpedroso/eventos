# 11 — Go-live com Asaas (produção)

Checklist operacional para publicar o EventosBR com **Asaas** como provedor de pagamento.

**Última atualização:** 17/06/2026

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
| `STRIPE_DISABLED` | Recomendado | `true` se só Asaas |

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

Migrações Asaas obrigatórias:
- `20260617_000020` — colunas `asaas_*` em usuários, eventos, ingressos
- `20260617_000021` — subconta e antecipação do organizador

---

## 3. Webhook Asaas

**URL:** `https://SEU_DOMINIO/api/webhooks/asaas`

No painel Asaas → Integrações → Webhooks:
- Token = valor de `ASAAS_WEBHOOK_TOKEN` no `.env`
- Eventos: `PAYMENT_RECEIVED`, `PAYMENT_CONFIRMED`, `PAYMENT_REFUNDED`, `PAYMENT_OVERDUE`, `PAYMENT_DELETED`

Referência: `./scripts/asaas-webhook-setup.sh SEU_DOMINIO.com.br`

---

## 4. Organizadores — repasses

Antes de vender ingressos pagos, cada organizador deve:
1. Aceder **Organizador → Financeiro**
2. Informar o `walletId` da conta Asaas **ou** criar subconta pela plataforma
3. Confirmar badge «Repasses configurados»

Sem `walletId`, o checkout retorna erro (proteção de split).

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
- Backup diário: cron com `./scripts/backup-postgres.sh`

---

## 7. Checkout — métodos disponíveis

| Método | UX |
|--------|-----|
| **PIX** | QR + copia e cola; confirmação via webhook |
| **Cartão** | Formulário transparente (dados vão direto ao Asaas) |
| **Fatura** | Redirect para página Asaas (boleto/cartão/PIX) |

---

## 8. Rollback / contingência

- `ASAAS_DISABLED=true` — desativa cobranças (modo manutenção)
- `PAYMENT_PROVIDER=stripe` + chaves Stripe — fallback legado
- Restaurar DB: `./scripts/restore-postgres.sh`

---

## Referências

- `docs/08-deploy-hostinger.md` — VPS e Caddy
- `docs/06-configuracao-operacao.md` — operação geral
- `docs/10-checklist-proximo-patamar.md` — roadmap produto
