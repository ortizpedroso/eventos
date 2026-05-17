# 07 — Fase D (produção e fiscal)

Itens planejados após as fases A–C e o painel admin de marketing.

## Produção e operação

- [x] Commit/tag de release e CI verde no remoto
- [ ] Webhook Stripe com `STRIPE_WEBHOOK_SECRET` real em produção (`scripts/stripe-webhook-dev.ps1` em dev)
- [ ] SMTP validado (SPF/DKIM) para ingressos e campanhas
- [ ] Stripe Connect ativo (`STRIPE_SKIP_CONNECT_ON_REGISTER=false` após termos)
- [x] `.dockerignore` e imagens enxutas (build rápido)

## Comprador

- [x] Teste API: compra (STRIPE_DISABLED) → ingresso pago → e-mail enfileirado (`test_fase_d.py`)
- [ ] Teste E2E: compra PIX/cartão real no browser (Stripe test)
- [x] Fila de e-mail resiliente (Redis com retry; fallback em memória)

## Organizador / financeiro Brasil

- [ ] Conciliação Stripe Connect (valores reais vs. estimativa em `tarifas_plataforma.py`)
- [ ] NFSe e comprovante de repasse (integração fiscal — a definir)

## Admin plataforma

- [x] Moderação de eventos (publicar/ocultar na vitrine + aba no painel admin)
- [x] Checklist de produção (`GET /api/admin/setup` + aba Produção)
- [x] Moderação de usuários (desativar conta + bloqueio no login)
- [ ] `MARKETING_WHATSAPP_WEBHOOK_URL` em produção (opcional)
- [ ] Restringir acesso ao painel (lista de operadores ou SSO)

## Qualidade

- [x] Testes E2E smoke (Playwright — home, eventos, documentação, alias)
- [ ] Teste E2E fluxo completo de compra (Stripe test)
- [x] Avisos de config incompleta no arranque (`production_checks`)
- [ ] Monitoramento (logs estruturados, alertas em `/ready` 503)
