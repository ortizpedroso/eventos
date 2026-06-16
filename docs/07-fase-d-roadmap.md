# 07 — Fase D (produção e fiscal)

Itens planejados após as fases A–C e o painel admin de marketing.

**Última revisão:** 16/06/2026

## Status geral do projeto

| Fase | Escopo | Situação |
|------|--------|----------|
| **A** | Checkout 3 passos, PIX QR, e-mail ingresso, rate limit, rotas `/eventos` | ✅ Concluída |
| **B** | CPF limite, lotes/cortesia, check-in, export PDF/Excel, financeiro estimado | ✅ Concluída |
| **C** | Cupons, comunicados organizador, métricas, LGPD marketing | ✅ Concluída |
| **Admin** | Marketing, campanhas, moderação eventos/usuários, checklist produção | ✅ Operacional |
| **D** | Produção real, fiscal BR, E2E compra browser, monitoramento | 🟡 Em andamento (~70%) |

**Testes automatizados:** 42 passed (`pytest tests/`).

**Pré-produção (implementado no repo):** `docker-compose.prod.yml`, Caddy, `.env.production.example`, deploy Hostinger, backup/restore, secrets, E2E compra (`docker compose -p eventosbr-e2e` + Playwright).

**Funcionalidades pós-fase C implementadas:**
- [x] Login social OAuth (Google) — backend + frontend
- [x] Link de portaria sem conta (`checkin_token` + `/api/portaria`)
- [x] Repasse / venda de ingresso (`POST /api/ingressos/{id}/repassar` + UI no painel do comprador)
- [x] Auditoria segurança/UX (jun/2026) — ver checklist em [09-auditoria-seguranca-ux.md](./09-auditoria-seguranca-ux.md)

---

## Produção e operação

- [x] Commit/tag de release e CI verde no remoto
- [x] Webhook Stripe em dev (`stripe-webhook-setup.ps1`, `stripe-webhook-dev.ps1`, `compra_teste_stripe.py`)
- [x] Validação manual dev: PI confirmado + webhook → ingresso pago
- [x] `PaymentIntent` cartão com `allow_redirects: never`
- [x] `docker-compose.prod.yml` + Caddy + `.env.production.example`
- [x] Guia deploy Hostinger ([08-deploy-hostinger.md](./08-deploy-hostinger.md))
- [x] Scripts backup/restore Postgres, `generate-secrets`, `deploy-vps.sh`
- [ ] Webhook Stripe com `STRIPE_WEBHOOK_SECRET` real em **produção** (Dashboard Stripe)
- [ ] SMTP validado (SPF/DKIM) no domínio
- [ ] Stripe Connect ativo (`STRIPE_SKIP_CONNECT_ON_REGISTER=false` após termos)
- [x] `.dockerignore` e imagens enxutas

> Após alterar `.env` no VPS: `docker compose -f docker-compose.prod.yml up -d` (não só `restart`).

## Comprador

- [x] Teste API: compra (`STRIPE_DISABLED`) → e-mail (`test_fase_d.py`)
- [x] Teste API: compra Stripe test + webhook (`test_webhook_stripe_flow.py`, `compra_teste_stripe.py`)
- [x] Teste E2E browser: checkout com `STRIPE_DISABLED` (`e2e/compra-checkout.spec.ts`, `docker-compose.e2e.yml`)
- [ ] Teste E2E browser com Stripe Elements (`4242…`, `E2E_STRIPE=1`)
- [x] Fila de e-mail resiliente (Redis)

## Comprador

- [x] Repasse / transferência de ingresso para terceiros (dados do novo participante; histórico gravado)

## Organizador / financeiro Brasil

- [ ] Conciliação Stripe Connect (valores reais vs. `tarifas_plataforma.py`)
- [ ] NFSe e comprovante de repasse

## Admin plataforma

- [x] Moderação de eventos e usuários, checklist produção, login admin validado
- [ ] `MARKETING_WHATSAPP_WEBHOOK_URL` em produção (opcional)
- [ ] Restringir acesso ao painel (SSO / lista de operadores)

## Qualidade

- [x] Testes E2E smoke (Playwright)
- [x] Teste E2E fluxo de compra (modo STRIPE_DISABLED)
- [x] Avisos de config incompleta (`production_checks`)
- [ ] Monitoramento (logs estruturados, alertas `/ready` 503)

---

## Go-live (só no dia da publicação)

1. DNS `A` → IP do VPS Hostinger  
2. `.env` com chaves Stripe **live** + webhook produção  
3. `docker compose -f docker-compose.prod.yml up -d --build`  
4. Smoke manual + aba Produção no admin verde  
