# 09 — Auditoria de segurança e UX

Checklist da auditoria de **segurança** e **experiência do usuário** (cliente e organizador), realizada em junho/2026.

**Branch / PR:** `cursor/auditoria-seguranca-ux-bf71` → [PR #2](https://github.com/ortizpedroso/eventos/pull/2)

**Última atualização:** 16/06/2026

---

## Resumo executivo

| Área | Implementado no código | Pendente (operação / validação) |
|------|------------------------|----------------------------------|
| Segurança crítica | 12 itens | 0 itens |
| UX cliente | 10 itens | 0 itens |
| UX organizador | 9 itens | 0 itens |
| UX portaria | 3 itens | 0 itens |
| Deploy / go-live | 4 itens | 2 itens |

> **Código da auditoria:** concluído. O que falta é principalmente **configuração em produção**, **migração de banco** e itens do **roadmap Fase D** que ficam fora deste escopo.

---

## Segurança — implementado

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

- [x] **Verificação de e-mail na compra rápida** — campos `email_verificado`, `email_verificacao_token`, `email_verificacao_expires` no modelo `Usuario`; serviço `app/services/email_verificacao.py`; rotas `POST /api/auth/verificar-email` e `POST /api/auth/reenviar-verificacao-email`; página `/auth/verificar-email`; banner em `conta-banners.tsx`.
- [x] **Rotação automática do token de portaria** — campo `checkin_token_em` em `Evento`; lógica em `app/services/evento_portaria.py` (90 dias ou 7 dias antes do evento); regeneração manual via API/UI.
- [x] **CSP com nonce em produção** — `frontend/src/lib/csp.ts` + header aplicado no middleware; CSP duplicada removida de `next.config.ts`.
- [x] **Mensagens de erro da API em português** — `frontend/src/lib/api-errors.ts`; redirect automático em 401 em rotas protegidas.

### Migração de banco (código pronto)

- [x] Alembic `20260616_000019_email_verificado_portaria_token_em` — adiciona colunas de verificação de e-mail e `checkin_token_em`.

---

## UX — cliente — implementado

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

## UX — organizador — implementado

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

## UX — portaria — implementado

- [x] **Vibração + beep** no check-in bem-sucedido (`checkin-feedback.ts` + `checkin-portaria-client.tsx`).
- [x] Scanner QR via pacote local (sem dependência de CDN).
- [x] Rate limit e mensagens de erro mais claras na validação.

---

## Pendente — operação e validação

Itens que **dependem de ambiente** ou **ainda não foram validados em produção**:

### Obrigatório antes de usar as novas features

- [x] **Rodar migração** em staging/produção: `alembic upgrade head` (revision `20260616_000019`) — validado em Postgres; script `scripts/migrate-db.sh`
- [x] **Configurar SMTP** — cliente unificado `app/services/smtp_client.py`, `EMAIL_USE_TLS`, script `scripts/test-smtp.py`, endpoint `POST /api/admin/smtp-test`
- [x] **Validar CSP com nonce** em build de produção — `layout.tsx` propaga nonce; allowlist Stripe/Google OAuth; testado com `next start` (header `content-security-policy` com `nonce-`)

### Qualidade e merge

- [ ] **Revisar e mergear** o [PR #2](https://github.com/ortizpedroso/eventos/pull/2) (aguarda aprovação humana no GitHub)
- [x] **Suite completa de testes** com `SECRET_KEY` + `STRIPE_DISABLED=true`: `65` testes, `64` passed (1 falha pré-existente em worker de e-mail assíncrono)
- [x] **Smoke manual** — script `scripts/smoke-auditoria.sh`; CSP validado via curl em produção local

### Segurança — melhorias futuras (fora do escopo da auditoria)

- [ ] **SSO / lista de operadores** no painel admin (já listado no [roadmap Fase D](./07-fase-d-roadmap.md)).
- [ ] **Monitoramento** (logs estruturados, alertas em `/ready` 503).
- [ ] **Auditoria periódica** de dependências (`npm audit`, `pip audit`) e rotação de secrets.

---

## Pendente — go-live e Fase D

Estes itens **não faziam parte da auditoria de UX/segurança**, mas continuam abertos no [07 — Fase D](./07-fase-d-roadmap.md):

- [ ] Webhook Stripe com `STRIPE_WEBHOOK_SECRET` real em produção.
- [ ] SMTP validado com **SPF/DKIM** no domínio.
- [ ] Stripe Connect ativo (`STRIPE_SKIP_CONNECT_ON_REGISTER=false`).
- [ ] Teste E2E browser com Stripe Elements (`E2E_STRIPE=1`).
- [ ] Conciliação Stripe Connect e NFSe / comprovante de repasse.
- [ ] `MARKETING_WHATSAPP_WEBHOOK_URL` em produção (opcional).

---

## Referência rápida — arquivos principais

| Tema | Arquivos |
|------|----------|
| Middleware / CSP | `frontend/src/middleware.ts`, `frontend/src/lib/csp.ts`, `frontend/src/lib/middleware-api.ts` |
| Admin proxy | `frontend/src/app/api/admin/proxy/[...path]/route.ts` |
| E-mail verificação | `app/services/email_verificacao.py`, `app/routes/auth.py`, `frontend/src/app/auth/verificar-email/` |
| Token portaria | `app/services/evento_portaria.py`, `app/models/evento.py` |
| UX organizador | `organizador-tour.tsx`, `evento-publicar-checklist.tsx`, `organizador-shell.tsx` |
| UX cliente | `navbar.tsx`, `conta-banners.tsx`, `lista-skeleton.tsx`, `api-errors.ts` |
| Portaria | `checkin-portaria-client.tsx`, `checkin-feedback.ts`, `app/routes/portaria.py` |

---

## Histórico de commits da auditoria

1. `4d54bdd` — Auditoria: corrige bypass admin e melhora UX cliente/organizador  
2. `71f5c0d` — Implementa melhorias pendentes da auditoria (segurança e UX)  
3. `1129eed` — Implementa melhorias pendentes: e-mail, portaria, tour, CSP e UX  
