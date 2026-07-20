# 12 — Checklist de publicação EventosBR

**Atualizado:** 2026-07-12  
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
- [x] Modo `linked` padrão (`ASAAS_ONBOARDING_MODE=linked`)
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
- [x] Rodapé login corrigido (`auth/layout.tsx`)
- [x] Máscaras CPF/CNPJ, CEP, telefone
- [x] Imagens marketing em `/funcionalidades` (`public/marketing/*.webp`)

### Segurança

- [x] CSP com nonce, proxy admin, rate limit portaria
- [x] Verificação e-mail, rotação token portaria
- [x] `production_checks.py` → `GET /api/admin/setup`

### Qualidade

- [x] `pytest` — 204+ testes (incl. fluxo compra/split mock)
- [x] `npm run build` — OK
- [x] CI — `.github/workflows/ci.yml` (api, web, e2e)

---

## 2. Operação — você precisa fazer no VPS 🔧

| # | Item | Como validar |
|---|------|--------------|
| 1 | Preencher `.env` produção | `cp .env.production.example .env` + secrets |
| 2 | `ASAAS_API_KEY` produção (`$aact_prod_...`) | Painel Asaas → Integrações |
| 3 | `ASAAS_PLATFORM_WALLET_ID` | Minha conta → wallet da plataforma |
| 4 | `ASAAS_WEBHOOK_TOKEN` forte | Gerar com `./scripts/generate-secrets.sh` |
| 5 | `ASAAS_ONBOARDING_MODE=linked` | Padrão no código; confirmar no `.env` |
| 6 | `ASAAS_ENVIRONMENT=production` | Não usar homologação em go-live |
| 7 | Webhook no painel Asaas | `POST https://DOMINIO/api/webhooks/asaas` + token |
| 8 | SMTP + SPF/DKIM | `scripts/test-smtp.py` + DNS do domínio |
| 9 | `SECRET_KEY`, `POSTGRES_PASSWORD`, `PLATFORM_ADMIN_API_KEY` | ≥ 32 chars / senhas fortes |
| 10 | `CORS_ORIGINS` HTTPS (sem `*`) | URLs do site |
| 11 | `FRONTEND_PUBLIC_URL` | URL pública (`https://eventosbr.app.br`) |
| 12 | Deploy | `./scripts/deploy-vps.sh` ou `atualizar-vps-agora.sh` |
| 13 | Migração DB | `alembic upgrade head` (automático no deploy) |
| 14 | Organizador vincula wallet | Financeiro → Vincular conta Asaas |
| 15 | Primeira venda real | PIX ou cartão + webhook + ingresso pago |

**Scripts úteis:** `docs/11-go-live-asaas.md`, `scripts/go-live-anexo-b.sh`, `scripts/verify-production.sh`

### Testes sandbox Asaas (antes do go-live) 🧪

Testes sandbox foram concluídos internamente. Ver `docs/11-go-live-asaas.md` para instruções de ambiente manual.

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
| **Testes** | ✅ 200 pytest + build Next.js |
| **VPS / Asaas / DNS / SMTP** | 🔧 Pendente (ação sua) |
| **Melhorias UX/SEO** | ⏳ Opcionais pós-lançamento |
| **Funcionalidades avançadas** | 🚫 Próximos patamares |
