# 08 — Deploy na Hostinger (VPS)

Guia para subir o EventosBR em um **VPS Hostinger** com domínio próprio. O que pode ser feito **antes** do go-live está no repositório; o que exige DNS/chaves **live** fica para o dia da publicação.

## Arquitetura no VPS

```
Internet → Caddy (:443) → /api/*, /health, /ready → api (FastAPI :8000)
                        → resto → web (Next.js :3000)
         → db (Postgres, rede interna)
         → redis (rede interna)
```

Ficheiros principais:

| Ficheiro | Uso |
|----------|-----|
| `docker-compose.prod.yml` | Stack produção (sem bind mount) |
| `deploy/caddy/Caddyfile` | HTTPS automático |
| `.env.production.example` | Modelo de variáveis |
| `scripts/deploy-vps.sh` | `git pull` + rebuild |
| `scripts/backup-postgres.sh` | Backup da base |
| `scripts/backup-postgres-cron.sh` | Backup + rotação + upload off-site |
| `scripts/monitor-ready.sh` | Alerta se `/ready` falhar |
| `scripts/configure-asaas-env.sh` | Preencher credenciais Asaas no `.env` |

## Fase A — Antes de ter o VPS (pode fazer agora)

1. **Testes locais**
   - `python -m pytest tests/ -q`
   - `docker compose -p eventosbr-e2e -f docker-compose.e2e.yml up -d --build --wait`
   - `cd frontend && PLAYWRIGHT_SKIP_WEBSERVER=1 npm run test:e2e:compra`
2. **Secrets** — `.\scripts\generate-secrets.ps1` (guardar no gestor de senhas).
3. **Domínio na Hostinger** — registar; preparar zona DNS (ver Fase C).
4. **E-mail** — criar `noreply@seudominio.com.br` (Hostinger Email ou Brevo/Resend).
5. **Asaas** — sandbox ou produção; webhook em `https://<domínio>/api/webhooks/asaas` (ver [11-go-live-asaas.md](./11-go-live-asaas.md)).

## Fase B — Preparar o VPS (sem tráfego público ainda)

1. Contratar **VPS** (recomendado ≥ 2 GB RAM).
2. Instalar **Docker** + **Docker Compose** v2.
3. Clonar o repositório:
   ```bash
   git clone https://github.com/ortizpedroso/eventos.git /opt/eventosbr
   cd /opt/eventosbr
   ```
4. Criar `.env`:
   ```bash
   cp .env.production.example .env
   nano .env   # DOMAIN, senhas, chaves test primeiro
   ```
5. **Staging com chaves test** (opcional): subir stack e testar por IP:
   ```bash
   docker compose -f docker-compose.prod.yml up -d --build
   ```
6. Agendar backup (cron diário com rotação e log):
   ```bash
   chmod +x scripts/backup-postgres-cron.sh scripts/upload-backup-offsite.sh
   crontab -e
   # 0 3 * * * cd /opt/eventosbr && ./scripts/backup-postgres-cron.sh
   ```
   Opcional: `BACKUP_OFFSITE_TARGET` no `.env` para cópia remota (S3, rclone, scp).
7. Monitorar `/ready` (a cada 5 min):
   ```bash
   # */5 * * * * cd /opt/eventosbr && ./scripts/monitor-ready.sh
   ```

## Fase C — Go-live (dia da publicação)

1. **DNS** na Hostinger (zona do domínio):
   - `A` `@` → IP do VPS
   - `A` `www` → IP do VPS (Caddy redireciona www → apex)
2. **E-mail** — registos **SPF**, **DKIM** (painel Hostinger → Email → DNS).
3. **Asaas produção** (provedor principal — ver `docs/11-go-live-asaas.md`)
   - `PAYMENT_PROVIDER=asaas`
   - `ASAAS_API_KEY` com chave `$aact_prod_...`
   - `ASAAS_PLATFORM_WALLET_ID` da conta EventosBR
   - `ASAAS_WEBHOOK_TOKEN` — token forte no `.env`
   - Webhook: `https://SEU_DOMINIO/api/webhooks/asaas`
   - Eventos: `PAYMENT_RECEIVED`, `PAYMENT_CONFIRMED`, reembolsos/atrasos
4. Ajustar `.env`:
   - `ENVIRONMENT=production`, `DEBUG=False`
   - `CORS_ORIGINS=https://seudominio.com.br,https://www.seudominio.com.br`
   - `FRONTEND_PUBLIC_URL` / `NEXT_PUBLIC_API_URL` com HTTPS
   - `ASAAS_DISABLED=false` (não use `true` em produção)
5. Recriar containers:
   ```bash
   ./scripts/deploy-vps.sh
   ```
6. **Smoke pós-deploy**
   - `./scripts/verify-production.sh`
   - `curl -fsS https://seudominio.com.br/ready`
   - Organizador configura wallet em Financeiro → compra teste PIX/cartão
   - Painel `/admin/dashboard` → aba **Produção** verde
7. **Firewall** — só portas 22 (SSH restrito), 80, 443 abertas.

## Variáveis críticas

Ver `.env.production.example` e checklist em `GET /api/admin/setup` (aba Produção no admin).

## Atualizações

```bash
cd /opt/eventosbr
./scripts/deploy-vps.sh
```

## Troubleshooting

- [TROUBLESHOOTING.md](../TROUBLESHOOTING.md) — webhook Asaas, Docker, admin.
- Após mudar `.env`: `docker compose -f docker-compose.prod.yml up -d` (não só `restart`).
- Logs: `docker compose -f docker-compose.prod.yml logs -f api web caddy`

## O que não faz parte deste deploy

- NFSe / conciliação fiscal (roadmap Fase D).
- SSO no admin (futuro).
