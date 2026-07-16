# 14 — Teste sandbox Asaas (VPS)

**Atualizado:** 2026-07-14

Fluxo completo para testar pagamentos em **sandbox** sem perder credenciais de **produção**.

---

## Comandos na Hostinger (copiar e colar)

### Primeira vez — credenciais sandbox

```bash
cd /opt/eventosbr
git pull origin main

# Interativo (API key, walletId, token webhook)
bash scripts/setup-sandbox-pending.sh
```

Ou manualmente:

```bash
cp .env.asaas-sandbox-pending.example .env.asaas-sandbox-pending
nano .env.asaas-sandbox-pending
```

### Entrar em sandbox (com backup automático da produção)

```bash
cd /opt/eventosbr
bash scripts/ir-sandbox-asaas.sh --reload
```

Isso faz:

1. `backup-prod-env.sh` → `.env.prod-backup` + cópia em `backups/env-prod-*.env`
2. `verify-prod-backup.sh`
3. Alterna `.env` para sandbox
4. Reinicia API
5. Testa API + webhook

### Painel Asaas SANDBOX (obrigatório)

| Item | Valor |
|------|--------|
| URL | `https://eventosbr.app.br/api/webhooks/asaas` |
| Token | = `ASAAS_WEBHOOK_TOKEN` do `.env` |
| Webhook | **Ativo** |
| Fila sincronização | **Ligada** |
| Logs | Reativar fila se estiver pausada |

### Teste manual webhook

```bash
bash scripts/test-asaas-webhook.sh
```

### Teste automatizado compra + split

```bash
# Requer ASAAS_ORGANIZER_API_KEY (conta sandbox secundária) no .env ou .env.asaas-sandbox-pending
bash scripts/test-sandbox-compra-split.sh
```

Valida: organizador com wallet distinto, evento, PIX, split para o organizador, taxa na conta emissora, ingresso pago.

### Compra teste

1. Organizador → Financeiro → **Vincular conta Asaas** (walletId de conta sandbox secundária)
2. Compra PIX/cartão em valor baixo
3. Conferir Logs de Webhooks → HTTP 200

### Voltar para produção

```bash
cd /opt/eventosbr
bash scripts/voltar-producao-asaas.sh --reload
```

Restaura `.env.prod-backup` e reinicia a API.

---

## Arquivos (gitignored — só no VPS)

| Arquivo | Conteúdo |
|---------|----------|
| `.env.prod-backup` | Produção completa |
| `.env.asaas-prod-backup` | Subset Asaas produção |
| `.env.asaas-sandbox-pending` | Credenciais sandbox |
| `.asaas-sandbox-active` | Marcador “em teste sandbox” |
| `backups/env-prod-*.env` | Cópias datadas extra |

---

## Scripts

| Script | Função |
|--------|--------|
| `setup-sandbox-pending.sh` | Cria `.env.asaas-sandbox-pending` |
| `ir-sandbox-asaas.sh` | Backup + sandbox + testes |
| `voltar-producao-asaas.sh` | Restaura produção |
| `test-asaas-webhook.sh` | POST de teste no webhook |
| `test-asaas-sandbox.sh` | GET /v3/myAccount |
