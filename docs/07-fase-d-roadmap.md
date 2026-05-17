# 07 — Fase D (produção e fiscal)

Itens planejados após as fases A–C e o painel admin de marketing.

**Última revisão:** 17/05/2026

## Status geral do projeto

| Fase | Escopo | Situação |
|------|--------|----------|
| **A** | Checkout 3 passos, PIX QR, e-mail ingresso, rate limit, rotas `/eventos` | ✅ Concluída |
| **B** | CPF limite, lotes/cortesia, check-in, export PDF/Excel, financeiro estimado | ✅ Concluída |
| **C** | Cupons, comunicados organizador, métricas, LGPD marketing | ✅ Concluída |
| **Admin** | Marketing, campanhas, moderação eventos/usuários, checklist produção | ✅ Operacional |
| **D** | Produção real, fiscal BR, E2E compra browser, monitoramento | 🟡 Em andamento (~55%) |

**Testes automatizados:** 42 passed (`pytest tests/`), incluindo `test_webhook_stripe_flow.py`.

**Validação manual recente (modo teste, sem custo real):** fluxo completo Stripe CLI → webhook → ingresso `pago` via `compra_teste_stripe.py` (~3s).

---

## Produção e operação

- [x] Commit/tag de release e CI verde no remoto
- [x] Webhook Stripe em dev (`stripe-webhook-setup.ps1`, `stripe-webhook-dev.ps1`, `compra_teste_stripe.py`)
- [x] Validação manual dev: PI confirmado + `payment_intent.succeeded` → API 200 → ingresso pago
- [x] `PaymentIntent` cartão com `allow_redirects: never` (confirmação CLI e fluxo sem redirect)
- [ ] Webhook Stripe com `STRIPE_WEBHOOK_SECRET` real em **produção** (endpoint no Dashboard Stripe, não CLI)
- [ ] SMTP validado (SPF/DKIM) para ingressos e campanhas
- [ ] Stripe Connect ativo (`STRIPE_SKIP_CONNECT_ON_REGISTER=false` após termos no Dashboard)
- [x] `.dockerignore` e imagens enxutas (build rápido)

> **Operação Docker:** após alterar `.env`, use `docker compose up -d api` (não só `restart`) para recarregar variáveis como `STRIPE_WEBHOOK_SECRET`.

## Comprador

- [x] Teste API: compra (`STRIPE_DISABLED`) → ingresso pago → e-mail enfileirado (`test_fase_d.py`)
- [x] Teste API: compra Stripe test + webhook (`test_webhook_stripe_flow.py` + `compra_teste_stripe.py`)
- [ ] Teste E2E: compra PIX/cartão real no **browser** (Stripe test, Playwright)
- [x] Fila de e-mail resiliente (Redis com retry; fallback em memória)

## Organizador / financeiro Brasil

- [ ] Conciliação Stripe Connect (valores reais vs. estimativa em `tarifas_plataforma.py`)
- [ ] NFSe e comprovante de repasse (integração fiscal — a definir)

## Admin plataforma

- [x] Moderação de eventos (publicar/ocultar na vitrine + aba no painel admin)
- [x] Checklist de produção (`GET /api/admin/setup` + aba Produção)
- [x] Moderação de usuários (desativar conta + bloqueio no login)
- [x] Login admin com validação de chave (`validateAdminKey` antes de entrar no painel)
- [ ] `MARKETING_WHATSAPP_WEBHOOK_URL` em produção (opcional)
- [ ] Restringir acesso ao painel (lista de operadores ou SSO)

## Qualidade

- [x] Testes E2E smoke (Playwright — home, eventos, documentação, alias)
- [ ] Teste E2E fluxo completo de compra (Stripe test no navegador)
- [x] Avisos de config incompleta no arranque (`production_checks`)
- [ ] Monitoramento (logs estruturados, alertas em `/ready` 503)

---

## Próximos passos sugeridos (ordem)

1. **Commit** dos scripts webhook + testes + fix `pagamentos.py` (ainda não commitados em `main`).
2. **Produção:** criar endpoint webhook no Stripe Dashboard apontando para a API pública + `whsec` de produção.
3. **E2E Playwright:** compra com cartão `4242…` no frontend (complementa o script CLI já validado).
4. **SMTP:** SPF/DKIM no domínio do remetente de ingressos/campanhas.
5. **Connect:** ativar termos e `STRIPE_SKIP_CONNECT_ON_REGISTER=false` quando for repassar a organizadores.
