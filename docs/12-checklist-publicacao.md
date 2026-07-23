# 12 — Checklist de publicação EventosBR

**Atualizado:** 2026-07-20  
**Spec de referência:** [`specs/eventosbr-producao.md`](../specs/eventosbr-producao.md)

Use este documento para saber o que **já está no código** e o que **ainda depende de você** (VPS, Asaas, DNS, etc.).

---

## Legenda

| Símbolo | Significado |
|---------|-------------|
| ✅ | Implementado e testado no repositório |
| 🔧 | Ação manual no VPS / painéis externos |
| ⏳ | Melhoria opcional (não bloqueia go-live) |
| 🚫 | Fora de escopo desta publicação |

---

## 1. Código — pronto para publicar ✅

### Pagamentos e repasse

- [x] Split Asaas: só wallet do organizador; taxa na conta emissora
- [x] Modo `baas` padrão (`ASAAS_ONBOARDING_MODE=baas`); `linked` disponível via `.env`
- [x] Vínculo de wallet: `PUT /api/organizador/asaas/wallet`
- [x] Validação wallet (UUID, ≠ plataforma, API key opcional)
- [x] Bloqueio de venda/publicação sem repasse aprovado
- [x] Extrato, vendas agrupadas, estornos, saque BaaS (modo `baas`/`both`)
- [x] Webhooks `PAYMENT_*` e handlers de conta (BaaS)

### UX produto (P1–P10)

- [x] P1 — Home, logo, hero, busca, footer
- [x] P2 — Checkout white-label, badges PIX/cartão/seguro
- [x] P3 — Vitrine com filtros, mapa, urgência, relacionados
- [x] P4 — Planos + simuladores organizador (wizard/checkout)
- [x] P5 — Parcelamento 2/3/6/12x; lista interesse e espera
- [x] P6 — Página `/produtor/{slug}`
- [x] P7 — `/ajuda`, blog, `/documentacao/api`
- [x] P8 — Wizard 3 passos (criar), checklist publicação, tour
- [x] P9 — Portaria QR local, som/vibração, rate limit
- [x] P10 — `sitemap.ts`, `robots.ts`, metadata por página

### UX conta e login

- [x] `ContaShell` lateral em `/conta/*`
- [x] Dropdown conta: Perfil, Pagamentos, Ingressos, Notificações
- [x] Rodapé login corrigido (`layout.tsx` flex + `EarlyScrollReset` + `auth/layout.tsx`)
- [x] Máscaras CPF/CNPJ, CEP, telefone
- [x] Imagens marketing em `/funcionalidades` (`public/marketing/*.webp`)

### Segurança

- [x] CSP com nonce, proxy admin, rate limit portaria
- [x] Verificação e-mail, rotação token portaria
- [x] `production_checks.py` → `GET /api/admin/setup`

### Qualidade

- [x] `pytest` — 208 testes
- [x] Teste mock split VPS: `bash scripts/test-compra-split-mock.sh`
- [x] `npm run build` — OK
- [x] CI — `.github/workflows/ci.yml` (api, web, e2e)

---

## 2. Operação — você precisa fazer no VPS 🔧

| # | Item | Como validar | Status VPS (jul/2026) |
|---|------|--------------|------------------------|
| 1 | Preencher `.env` produção | `cp .env.production.example .env` + secrets | ✅ OK |
| 2 | `ASAAS_API_KEY` produção (`$aact_prod_...`) | Painel Asaas → Integrações | ✅ OK |
| 3 | `ASAAS_PLATFORM_WALLET_ID` | Minha conta → wallet da plataforma | ✅ OK |
| 4 | `ASAAS_WEBHOOK_TOKEN` forte | Gerar com `./scripts/generate-secrets.sh` | ✅ OK |
| 5 | `ASAAS_ONBOARDING_MODE=baas` | Padrão no código; confirmar no `.env` | 🔧 Confirmar |
| 6 | `ASAAS_ENVIRONMENT=production` | Não usar homologação em go-live | 🔧 Confirmar |
| 7 | Webhook no painel Asaas | `POST https://DOMINIO/api/webhooks/asaas` + token | 🔧 Configurar + testar evento real |
| 8 | SMTP + SPF/DKIM | `scripts/test-smtp.py` + DNS do domínio | 🔧 Enviar e-mail real |
| 9 | `SECRET_KEY`, `POSTGRES_PASSWORD`, `PLATFORM_ADMIN_API_KEY` | ≥ 32 chars / senhas fortes | ✅ OK |
| 10 | `CORS_ORIGINS` HTTPS (sem `*`) | URLs do site | ✅ OK |
| 11 | `FRONTEND_PUBLIC_URL` | URL pública (`https://eventosbr.app.br`) | ✅ OK |
| 12 | Deploy | `bash scripts/atualizar-vps-agora.sh` | ✅ Site no ar |
| 13 | Migração DB | `alembic upgrade head` (automático no deploy) | ✅ `20260717_000035` |
| 14 | Organizador vincula wallet / subconta BaaS | Financeiro → conta de repasses | 🔧 Por organizador |
| 15 | Primeira venda real | PIX ou cartão + webhook + ingresso pago | 🔧 Pendente |
| 16 | Teste mock split | `bash scripts/test-compra-split-mock.sh` | ✅ 2 passed |
| 17 | Fix rodapé em produção | `curl -s https://DOMINIO/auth \| grep eventosbr-shell-layout` | ✅ (branch feature; merge PR #39) |

**Scripts úteis:** `docs/11-go-live-asaas.md`, `scripts/go-live-anexo-b.sh`, `scripts/verify-production.sh`

### GitHub — PR automático

Branches `cursor/*` disparam `.github/workflows/cursor-agent-pr.yml`, que abre/atualiza PR draft para `main` (CI roda em push e pull_request).

---

## 3. Melhorias opcionais (não bloqueiam) ⏳

| Item | Situação | Sugestão |
|------|----------|----------|
| Simulador comprador em `/planos` | Só no checkout/API | Página pública com `cotacaoCheckout` |
| Sitemap dinâmico | Só rotas estáticas | Incluir `/eventos/{slug}` e `/produtor/{slug}` via API no build |
| Mapa embed Google | Opcional | Definir `NEXT_PUBLIC_GOOGLE_MAPS_EMBED_KEY` |
| Blog | 1 post | Adicionar conteúdo em `frontend/content/blog/` |
| Wizard 3 passos na edição | Só em criar evento | Reutilizar steps em `/eventos/[id]/editar` |
| Metadata `/produtor/{slug}` | Genérica | `generateMetadata` com nome do organizador |

---

## 4. Fora de escopo desta publicação 🚫

Conforme spec §4 — **não implementar agora:**

- Múltiplos operadores por evento
- Formulário custom de inscrição
- Importação CSV de participantes
- Certificados de participação
- PWA equipe / app nativo portaria
- Apple/Google Wallet passes
- NFSe automática

---

## 5. Comandos de validação local

```bash
# API
python3 -m pytest tests/ -q

# Frontend
cd frontend && npm run build

# Smoke completo (pytest + health + CSP)
bash scripts/smoke-auditoria.sh

# Regenerar imagens marketing
python3 scripts/generate_marketing_png.py
```

---

## 6. Resumo executivo

| Categoria | Status |
|-----------|--------|
| **Código** | ✅ Completo para go-live |
| **Testes** | ✅ 208 pytest + build Next.js + mock split VPS |
| **VPS / Asaas / DNS / SMTP** | 🟡 Infra OK; falta 1ª venda real + webhook testado + SMTP DNS |
| **Git** | 🟡 PR #39 pendente merge na `main` |
| **Melhorias UX/SEO** | ⏳ Opcionais pós-lançamento |
| **Funcionalidades avançadas** | 🚫 Próximos patamares |
