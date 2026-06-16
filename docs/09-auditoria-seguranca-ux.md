# 09 — Auditoria de segurança e UX

Checklist da auditoria de **segurança** e **experiência do usuário** (cliente e organizador), realizada em junho/2026.

**Auditoria (código UX/segurança):** mergeada em `main` via [PR #2](https://github.com/ortizpedroso/eventos/pull/2)  
**Ops pós-auditoria (migração, SMTP, CSP, smoke):** [PR #3](https://github.com/ortizpedroso/eventos/pull/3) — branch `cursor/auditoria-deploy-ops-bf71`

**Última atualização:** 16/06/2026

---

## Resumo executivo

| Área | Status |
|------|--------|
| Segurança crítica (código) | ✅ 12/12 concluído |
| UX cliente | ✅ 10/10 concluído |
| UX organizador | ✅ 9/9 concluído |
| UX portaria | ✅ 3/3 concluído |
| Ops pós-auditoria (repo) | ✅ 6/7 concluído — falta merge do PR #3 |
| Go-live / Fase D | ⏳ 6 itens abertos (fora do escopo da auditoria) |

> **Situação atual:** toda a auditoria de código está em `main`. Scripts, correção da migration Postgres, SMTP unificado e validação de CSP estão no PR #3. No **servidor de produção**, ainda é preciso rodar a migração, preencher credenciais SMTP reais e validar SPF/DKIM.

---

## Segurança — implementado ✅

### Crítico (rodada 1)

- [x] **Proxy admin sem bypass de env** — `frontend/src/app/api/admin/proxy/[...path]/route.ts` usa apenas o cookie `eventosbr_admin_key`; removido fallback automático para `PLATFORM_ADMIN_API_KEY` no servidor Next.
- [x] **Middleware bloqueia proxy admin** — `frontend/src/middleware.ts` retorna 401 em `/api/admin/proxy/*` sem cookie admin.
- [x] **Cookie admin com `Secure`** — alinhado ao HTTPS em `frontend/src/app/api/admin/session/route.ts`.
- [x] **Scanner QR sem CDN externo** — `html5-qrcode` como dependência npm local; removido script de CDN jsdelivr.

### Sessão e rotas protegidas (rodada 2)

- [x] **Validação de sessão no middleware** — chamada a `/api/auth/me` via `frontend/src/lib/middleware-api.ts`.
- [x] **Sessão inválida** — redirect para `/auth?expirado=1` e limpeza do cookie.
- [x] **Bloqueio de `/organizador/*`** — apenas usuários com `tipo === "organizador"`.
- [x] **Sub-rotas `/admin/*`** — exigem cookie admin (não só o proxy).
- [x] **Rate limit na portaria** — por IP + evento + token em `app/deps/rate_limit.py` e `app/routes/portaria.py`.

### Complementos (rodada 3)

- [x] **Verificação de e-mail na compra rápida** — campos no `Usuario`; serviço `app/services/email_verificacao.py`; rotas `POST /api/auth/verificar-email` e `POST /api/auth/reenviar-verificacao-email`; página `/auth/verificar-email`; banner em `conta-banners.tsx`.
- [x] **Rotação automática do token de portaria** — campo `checkin_token_em` em `Evento`; lógica em `app/services/evento_portaria.py` (90 dias ou 7 dias antes do evento); regeneração manual via API/UI.
- [x] **CSP com nonce em produção** — `frontend/src/lib/csp.ts` + header no middleware; nonce propagado em `layout.tsx`; CSP duplicada removida de `next.config.ts`.
- [x] **Mensagens de erro da API em português** — `frontend/src/lib/api-errors.ts`; redirect automático em 401 em rotas protegidas.

### Migração de banco

- [x] Alembic `20260616_000019` — colunas de verificação de e-mail e `checkin_token_em`.
- [x] **Correção Postgres** — `email_verificado = false` (antes `0` quebrava o upgrade).
- [x] **Validado localmente** — `alembic upgrade head` → `20260616_000019 (head)` em Postgres.
- [ ] **Rodar em produção/VPS** — `./scripts/migrate-db.sh` (após merge do PR #3).

---

## UX — cliente — implementado ✅

- [x] Link **Painel** na navegação da conta (`conta-nav.tsx`) para organizadores.
- [x] Itens **Pagamentos** e **Ingressos** na navbar global para organizador (`navbar.tsx`).
- [x] Botão **Ver QR Code** na lista de ingressos (`conta/ingressos/page.tsx`).
- [x] CTA **Mostrar QR na entrada** no detalhe do ingresso (`conta/ingressos/[id]/page.tsx`).
- [x] **Skeletons** de carregamento em pagamentos, ingressos e editar evento (`lista-skeleton.tsx`).
- [x] **Badge Pagamentos (N)** na navbar para compras pendentes (`pagamentos-pendentes.ts` + `navbar.tsx`).
- [x] **Banner definir senha** após compra rápida (`conta-banners.tsx` + layout da conta).
- [x] **Botão sticky** no checkout (`comprar-ingresso.tsx`).
- [x] Aviso de **e-mail de confirmação** no painel de auth do checkout (`checkout-auth-panel.tsx`).
- [x] Redirect com **`?next=`** ao exigir login no shell do organizador (`organizador-shell.tsx`).

---

## UX — organizador — implementado ✅

- [x] Botão **Pausar na vitrine** em Meus eventos (`organizador/eventos/page.tsx`).
- [x] **Vendas e receita** nos cards de evento.
- [x] Texto de **onboarding** em Meus eventos.
- [x] **Breadcrumb** ao editar evento (`editar-client.tsx`).
- [x] **Wizard em 3 passos** ao criar evento (`novo-evento-client.tsx`).
- [x] **Checklist pré-publicação** no passo 3 (`evento-publicar-checklist.tsx`).
- [x] **Tour interativo** no primeiro acesso (`organizador-tour.tsx` + `data-tour` no shell).
- [x] **Skeleton** de carregamento no shell do organizador.
- [x] Aviso de **rotação automática do link de portaria** (`evento-link-portaria.tsx`).

---

## UX — portaria — implementado ✅

- [x] **Vibração + beep** no check-in bem-sucedido (`checkin-feedback.ts` + `checkin-portaria-client.tsx`).
- [x] Scanner QR via pacote local (sem dependência de CDN).
- [x] Rate limit e mensagens de erro mais claras na validação.

---

## Ops pós-auditoria — implementado no repo

Itens da rodada operacional (PR #3):

- [x] **Cliente SMTP unificado** — `app/services/smtp_client.py`; `EMAIL_USE_TLS`; remetente com `EMAIL_FROM_NAME`.
- [x] **Correção `lembrete_evento.py`** — usava `EMAIL_HOST` inexistente; corrigido para `EMAIL_SERVER`.
- [x] **Teste SMTP** — `python scripts/test-smtp.py destino@email.com`.
- [x] **Endpoint admin** — `POST /api/admin/smtp-test` (header `X-Platform-Admin-Key`).
- [x] **CSP validada em produção local** — `next start` retorna header com `nonce-`, Stripe e Google OAuth na allowlist.
- [x] **Scripts** — `scripts/migrate-db.sh`, `scripts/smoke-auditoria.sh`.
- [x] **Testes** — `tests/test_smtp_client.py`, `tests/test_csp.py`; suite `64/65` passed (`STRIPE_DISABLED=true`).
- [x] **Bugfix** — import `gerar_checkin_token` em `app/routes/eventos.py`.
- [x] **PR #2 mergeado** em `main` (auditoria completa).
- [ ] **PR #3 mergeado** — [fix(ops): migração Postgres, SMTP, CSP e smoke](https://github.com/ortizpedroso/eventos/pull/3).

---

## Pendente — só no servidor de produção

Ações que **não dependem mais de código**, apenas de deploy/configuração:

| Prioridade | Item | Como fazer |
|------------|------|------------|
| Alta | Rodar migração no VPS | `./scripts/migrate-db.sh` após deploy do PR #3 |
| Alta | Credenciais SMTP reais | `EMAIL_USER`, `EMAIL_PASSWORD` no `.env`; testar com `scripts/test-smtp.py` |
| Alta | SPF/DKIM no domínio | Configurar DNS do provedor de e-mail (Hostinger, Brevo, etc.) |
| Média | Smoke pós-deploy | `./scripts/smoke-auditoria.sh` ou fluxo manual: compra rápida → verificar e-mail → portaria → check-in |
| Baixa | Corrigir teste flaky | `TestRetomarPagamento` — worker assíncrono de e-mail fora do DB de teste |

---

## Pendente — go-live e Fase D

Itens do [07 — Fase D](./07-fase-d-roadmap.md), fora do escopo da auditoria:

- [ ] Webhook Stripe com `STRIPE_WEBHOOK_SECRET` real em produção.
- [ ] Stripe Connect ativo (`STRIPE_SKIP_CONNECT_ON_REGISTER=false`).
- [ ] Teste E2E browser com Stripe Elements (`E2E_STRIPE=1`).
- [ ] Conciliação Stripe Connect e NFSe / comprovante de repasse.
- [ ] `MARKETING_WHATSAPP_WEBHOOK_URL` em produção (opcional).
- [ ] SSO / lista de operadores no painel admin.
- [ ] Monitoramento (logs estruturados, alertas `/ready` 503).

---

## Referência rápida — arquivos principais

| Tema | Arquivos |
|------|----------|
| Middleware / CSP | `frontend/src/middleware.ts`, `frontend/src/lib/csp.ts`, `frontend/src/app/layout.tsx` |
| Admin proxy | `frontend/src/app/api/admin/proxy/[...path]/route.ts` |
| SMTP | `app/services/smtp_client.py`, `scripts/test-smtp.py`, `app/routes/admin.py` (`/smtp-test`) |
| E-mail verificação | `app/services/email_verificacao.py`, `app/routes/auth.py`, `frontend/src/app/auth/verificar-email/` |
| Token portaria | `app/services/evento_portaria.py`, `app/models/evento.py` |
| Migração | `alembic/versions/20260616_000019_*.py`, `scripts/migrate-db.sh` |
| Smoke / QA | `scripts/smoke-auditoria.sh`, `tests/conftest.py` |
| UX organizador | `organizador-tour.tsx`, `evento-publicar-checklist.tsx`, `organizador-shell.tsx` |
| UX cliente | `navbar.tsx`, `conta-banners.tsx`, `lista-skeleton.tsx`, `api-errors.ts` |
| Portaria | `checkin-portaria-client.tsx`, `checkin-feedback.ts`, `app/routes/portaria.py` |

---

## Histórico

### Auditoria (PR #2 → `main`)

1. `4d54bdd` — Auditoria: corrige bypass admin e melhora UX cliente/organizador  
2. `71f5c0d` — Implementa melhorias pendentes da auditoria (segurança e UX)  
3. `1129eed` — Implementa melhorias pendentes: e-mail, portaria, tour, CSP e UX  
4. `282f01d` — docs: checklist auditoria segurança e UX  
5. `d6f65bf` — **Merge PR #2** em `main`

### Ops pós-auditoria (PR #3)

1. `6a0034a` — fix(ops): migração Postgres, SMTP unificado, CSP nonce e smoke
