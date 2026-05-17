# 07 — Fase D (produção e fiscal)

Itens planejados após as fases A–C e o painel admin de marketing.

## Produção e operação

- [ ] Commit/tag de release e CI verde no remoto
- [ ] Webhook Stripe com `STRIPE_WEBHOOK_SECRET` real em produção
- [ ] SMTP validado (SPF/DKIM) para ingressos e campanhas
- [ ] Stripe Connect ativo (`STRIPE_SKIP_CONNECT_ON_REGISTER=false` após termos)
- [ ] `.dockerignore` e imagens enxutas (build rápido)

## Comprador

- [ ] Teste E2E: compra PIX/cartão → e-mail → ingresso na conta
- [ ] Fila de e-mail resiliente (Redis/worker) em vez de só thread

## Organizador / financeiro Brasil

- [ ] Conciliação Stripe Connect (valores reais vs. estimativa em `tarifas_plataforma.py`)
- [ ] NFSe e comprovante de repasse (integração fiscal — a definir)

## Admin plataforma

- [ ] Moderação de eventos/usuários além de campanhas marketing
- [ ] `MARKETING_WHATSAPP_WEBHOOK_URL` em produção (opcional)
- [ ] Restringir acesso ao painel (lista de operadores ou SSO)

## Qualidade

- [ ] Testes E2E (Playwright)
- [ ] Monitoramento (logs estruturados, alertas em `/ready` 503)
