# 12 — Checklist go-live restante (Anexo B)

Itens operacionais **fora do código** que ainda faltam para go-live 100%.  
Spec: [`specs/eventosbr-produto-completo.md`](../specs/eventosbr-produto-completo.md) · Anexo B.

**Domínio:** `eventosbr.app.br` · **VPS:** `/opt/eventosbr`

---

## Já concluído ✅

Marque mentalmente — não precisa refazer:

| Item | Como verificar |
|------|----------------|
| DNS apontando para o VPS | `curl -sI https://eventosbr.app.br` → 200 |
| `.env` com Asaas, SMTP, secrets | `./scripts/verify-production.sh` |
| API + web + Caddy no ar | `curl -s https://eventosbr.app.br/ready` |
| Webhook pagamentos Asaas | Token errado → `401`; token certo → `success` |
| Webhook transfer-auth | Configurado no painel + IP `187.77.240.125` |
| Google Maps embed | Página do evento mostra iframe do mapa |
| Login com Google | `curl -s https://eventosbr.app.br/api/auth/oauth-config` → `google_enabled: true` |
| E-mail SPF/DKIM + teste SMTP | `smtp-test` → caixa recebida ✅ |
| Ingresso cortesia (fluxo grátis) | Checkout cortesia gera ingresso `pago` |
| PR #30 / branch `cursor/spec-consolidada-build-bf71` | Review aprovado no repositório |

---

## Pendente — faça nesta ordem

### 1. E-mail SPF + DKIM (Hostinger) — ✅ concluído

**Por quê:** sem isso, ingressos e notificações caem em spam ou falham.

**Onde:** Hostinger → E-mails → `contato@eventosbr.app.br` (ou domínio) → **DNS / Registros DNS**

| Registro | Tipo | Valor (exemplo — use o que o Hostinger mostrar) |
|----------|------|--------------------------------------------------|
| SPF | TXT em `@` | `v=spf1 include:_spf.mail.hostinger.com ~all` |
| DKIM | TXT em `hostingermail-a._domainkey` | (copiar do painel Hostinger) |
| DMARC | TXT em `_dmarc` | `v=DMARC1; p=none; rua=mailto:contato@eventosbr.app.br` |

**Teste:**
```bash
# No VPS — e-mail de teste (requer PLATFORM_ADMIN_API_KEY no .env)
curl -sS -X POST "https://eventosbr.app.br/api/admin/smtp-test" \
  -H "Content-Type: application/json" \
  -H "X-Platform-Admin-Key: SEU_PLATFORM_ADMIN_API_KEY" \
  -d '{"destino":"seu-email@gmail.com"}'
```

- [x] SPF publicado (`v=spf1 include:_spf.mail.hostinger.com ~all`)
- [x] DKIM publicado (CNAME `hostingermail-a/b/c._domainkey`)
- [x] DMARC publicado (`v=DMARC1; p=none`)
- [x] E-mail de teste recebido (`smtp-test` → ortizphp@gmail.com, jul/2026)

---

### 2. Cron — backup Postgres

**No VPS** (`crontab -e` como root):

```cron
# Backup diário às 03:00 UTC
0 3 * * * cd /opt/eventosbr && ./scripts/backup-postgres-cron.sh >> /opt/eventosbr/backups/cron.log 2>&1
```

**Teste manual:**
```bash
cd /opt/eventosbr
./scripts/backup-postgres-cron.sh
ls -la backups/*.sql.gz | tail -3
```

- [ ] Backup manual OK
- [ ] Cron instalado
- [ ] (Opcional) `BACKUP_UPLOAD_CMD` / off-site no `.env`

---

### 3. Cron — monitor `/ready`

**No `.env`** (opcional mas recomendado):
```env
MONITOR_ALERT_WEBHOOK_URL=https://hooks.slack.com/...   # ou Discord/n8n
```

**Cron:**
```cron
*/5 * * * * cd /opt/eventosbr && ./scripts/monitor-ready.sh >> /opt/eventosbr/backups/monitor-ready.log 2>&1
```

**Teste:**
```bash
./scripts/monitor-ready.sh && echo OK
```

- [ ] Monitor manual OK
- [ ] Cron instalado
- [ ] Webhook de alerta configurado (opcional)

---

### 4. KYC Asaas — conta do organizador

**Por quê:** eventos **pagos** ficam pausados até a subconta ser aprovada.

**Passos (organizador logado):**
1. **Organizador → Financeiro → Conta de repasses**
2. Preencher CPF/CNPJ, dados bancários e documentos
3. Aguardar status **Conta aprovada** (webhook `ACCOUNT_STATUS_*` + poll na UI)

**Verificar API:**
```bash
# Com token JWT do organizador
curl -sS -H "Authorization: Bearer TOKEN" \
  https://eventosbr.app.br/api/organizador/asaas/acompanhamento
# repasse_aprovado: true
```

- [ ] Subconta criada
- [ ] Documentos enviados
- [ ] Status `approved` no painel
- [ ] Evento pago republicado na vitrine

---

### 5. Primeira venda real (PIX teste)

**Pré-requisito:** item 4 concluído.

1. Criar evento com ingresso **R$ 10,00** (mínimo) ou mais
2. Publicar na vitrine
3. Comprar como cliente (PIX)
4. Pagar no app do banco
5. Confirmar:
   - Webhook `PAYMENT_RECEIVED` nos logs:  
     `docker compose -f docker-compose.prod.yml logs api --tail=50`
   - Ingresso `pago` em **Meus ingressos**
   - E-mail com ingresso (item 1 ajuda)

- [ ] Cobrança PIX gerada
- [ ] Pagamento confirmado
- [ ] Ingresso marcado pago
- [ ] E-mail recebido

---

### 6. Merge do PR #30 no `main` + deploy final

Quando os itens acima estiverem OK (ou em paralelo após KYC):

```bash
# Após merge do PR #30 no GitHub:
cd /opt/eventosbr
git fetch origin main
git checkout main
git pull origin main
./scripts/atualizar-vps-agora.sh
./scripts/verify-production.sh
```

- [ ] PR #30 mergeado
- [ ] VPS em `main` atualizado
- [ ] `verify-production.sh` sem falhas críticas

---

## Comandos rápidos de saúde

```bash
cd /opt/eventosbr

# Stack
docker compose -f docker-compose.prod.yml ps

# Saúde
curl -s https://eventosbr.app.br/ready
curl -s https://eventosbr.app.br/api/auth/oauth-config

# Verificação completa
./scripts/verify-production.sh
```

---

## Referências

- [`docs/11-go-live-asaas.md`](./11-go-live-asaas.md) — go-live Asaas completo
- [`docs/08-deploy-hostinger.md`](./08-deploy-hostinger.md) — VPS e Caddy
- [`scripts/asaas-webhook-setup.sh`](../scripts/asaas-webhook-setup.sh)
- [`scripts/asaas-transfer-auth-setup.sh`](../scripts/asaas-transfer-auth-setup.sh)
