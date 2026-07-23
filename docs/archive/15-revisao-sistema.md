# 15 — Revisão do sistema (go-live)

**Atualizado:** 2026-07-20  
**Spec:** [`specs/eventosbr-producao.md`](../specs/eventosbr-producao.md) v1.1

---

## 1. Status do repositório (Git)

| Branch | Commit | Situação |
|--------|--------|----------|
| `main` | `3dad875` | Produção oficial no GitHub — **sem** fix rodapé nem script de teste mock |
| `cursor/fix-footer-flash-bf71` | `30b3626+` | PR #39 — **MERGEABLE**, aguardando merge |
| VPS atual | `30b3626` | Rodando **branch de feature**, não `main` |

**Ação:** merge PR #39 → `main`, depois `bash scripts/atualizar-vps-agora.sh` no VPS.

---

## 2. Status técnico

| Área | Status |
|------|--------|
| pytest | 208 testes passando |
| `npm run build` | OK |
| CI `main` | Verde (asserts alinhados) |
| Pagamentos Asaas + split | OK (código + mock 2/2 no VPS) |
| Onboarding padrão | `baas` (subconta); `linked` via `.env` |
| Rodapé | Fix na branch feature (`eventosbr-shell-layout` confirmado em produção) |
| VPS `eventosbr.app.br` | Site no ar, `/ready` OK, `verify-production.sh` OK |

---

## 3. O que já está implementado (código)

- Split Asaas, BaaS/linked, webhooks, assinatura, estornos, saque Pix
- UX P1–P10 (vitrine, checkout, planos, portaria, SEO, conta, wizard)
- Segurança: CSP, rate limit, verificação e-mail, production_checks
- Wallet organizador: consultar por API key + botão “Buscar ID”
- Teste mock: `tests/test_compra_split_fluxo_mock.py` + `scripts/test-compra-split-mock.sh`

---

## 4. O que falta para lançamento oficial

### Bloqueadores (fazer antes de anunciar)

| # | Item | Responsável | Como validar |
|---|------|-------------|--------------|
| 1 | **Merge PR #39** na `main` | Dev | PR mergeado; VPS em `main` |
| 2 | **1ª venda real** | Ops | PIX/cartão → webhook → ingresso pago → e-mail recebido |
| 3 | **Webhook Asaas** testado com evento real | Ops | Painel Asaas → log de entrega; ingresso muda para `pago` |
| 4 | **SMTP + SPF/DKIM** | Ops | E-mail de ingresso chega (não spam); DNS do domínio |
| 5 | **Organizador com repasse** | Ops | Subconta BaaS aprovada ou wallet `linked` antes de vender |

### Importante (não bloqueia anúncio, mas fazer em seguida)

| # | Item |
|---|------|
| 6 | Confirmar `ASAAS_ONBOARDING_MODE` e `ASAAS_ENVIRONMENT=production` no `.env` |
| 7 | Fechar PRs obsoletos (#16, #37, #38 duplicados) |
| 8 | Cron backup Postgres (`backup-postgres-cron.sh`) |
| 9 | Monitoramento `/ready` (`monitor-ready.sh` no cron) |
| 10 | Teste manual rodapé no browser (home scroll → Login) após merge |

### Fora do escopo deste lançamento

Múltiplos operadores, NFSe, Apple/Google Wallet, PWA equipe, importação CSV — ver spec §4.

---

## 5. Comandos VPS (referência)

```bash
cd /opt/eventosbr

# Deploy oficial (após merge na main)
bash scripts/atualizar-vps-agora.sh

# Teste split mock (não use python3 na raiz)
bash scripts/test-compra-split-mock.sh

# Verificar produção
bash scripts/verify-production.sh
bash scripts/verificar-versao-site.sh

# Confirmar fix rodapé
curl -s https://eventosbr.app.br/auth | grep -o 'eventosbr-shell-layout\|eventosbr-early-scroll-reset'
```

---

## 6. Correções deste ciclo (jul/2026)

- CI: testes alinhados às mensagens “conta de recebimento”
- Rodapé: flex shell + CSS crítico + `EarlyScrollReset`
- Wallet: `POST /api/organizador/asaas/wallet/consultar`
- Spec v1.1 + checklist publicação atualizados
- Script VPS para pytest mock dentro do Docker
