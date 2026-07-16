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

### Compra teste

1. Crie uma **segunda conta** em [sandbox.asaas.com](https://sandbox.asaas.com) (e-mail diferente da conta da plataforma).
2. Organizador → Financeiro → **Vincular conta Asaas**:
   - Cole a **chave API** da conta secundária e clique em **Buscar wallet**, ou
   - Cole manualmente o **walletId** dessa conta (não use o `ASAAS_PLATFORM_WALLET_ID` do `.env`).
3. Compra PIX/cartão em valor baixo
4. Conferir Logs de Webhooks → HTTP 200

**Erro comum:** *"Este walletId é o da conta da plataforma"* — você colou o wallet da conta EventosBR. Use o wallet de outra conta sandbox.

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
