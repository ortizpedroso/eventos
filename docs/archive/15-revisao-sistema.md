# 15 — Revisão do sistema (go-live)

> ⚠️ **Documento arquivado (2026-07-22).** Este é um retrato histórico do
> repositório em 2026-07-20. A PR #39 citada abaixo já foi mergeada
> (commit `df14c48`, "Merge pull request #39 from
> ortizpedroso/cursor/fix-footer-flash-bf71"). Para o status atual do
> sistema, consulte `git log`, o CI e `specs/eventosbr-producao.md`
> diretamente — não este arquivo.

**Atualizado:** 2026-07-20
**Spec:** [`specs/eventosbr-producao.md`](../../specs/eventosbr-producao.md) v1.1

---

## 1. Status do repositório (Git) — na época

| Branch | Commit | Situação |
|--------|--------|----------|
| `main` | `3dad875` | Produção oficial no GitHub — **sem** fix rodapé nem script de teste mock |
| `cursor/fix-footer-flash-bf71` | `30b3626+` | PR #39 — mergeada em `df14c48` |
| VPS atual | `30b3626` | Rodando branch de feature, não `main` (na época) |

---

## 2. Status técnico — na época

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

## 3. O que já estava implementado (código)

- Split Asaas, BaaS/linked, webhooks, assinatura, estornos, saque Pix
- UX P1–P10 (vitrine, checkout, planos, portaria, SEO, conta, wizard)
- Segurança: CSP, rate limit, verificação e-mail, production_checks
- Wallet organizador: consultar por API key + botão "Buscar ID"
- Teste mock: `tests/test_compra_split_fluxo_mock.py` + `scripts/test-sandbox-compra-split.sh`

---

## 4. O que faltava para lançamento oficial (histórico)

### Bloqueadores da época

| # | Item | Responsável | Como validar |
|---|------|-------------|--------------|
| 1 | ~~Merge PR #39 na `main`~~ | Dev | ✅ Mergeado em `df14c48` |
| 2 | 1ª venda real | Ops | PIX/cartão → webhook → ingresso pago → e-mail recebido |
| 3 | Webhook Asaas testado com evento real | Ops | Painel Asaas → log de entrega; ingresso muda para `pago` |
| 4 | SMTP + SPF/DKIM | Ops | E-mail de ingresso chega (não spam); DNS do domínio |
| 5 | Organizador com repasse | Ops | Subconta BaaS aprovada ou wallet `linked` antes de vender |

### Importante (na época)

| # | Item |
|---|------|
| 6 | Confirmar `ASAAS_ONBOARDING_MODE` e `ASAAS_ENVIRONMENT=production` no `.env` |
| 7 | Fechar PRs obsoletos (#16, #37, #38 duplicados) |
| 8 | Cron backup Postgres (`backup-postgres-cron.sh`) |
| 9 | Monitoramento `/ready` (`monitor-ready.sh` no cron) |
| 10 | Teste manual rodapé no browser (home scroll → Login) após merge |

### Fora do escopo deste lançamento (na época)

Múltiplos operadores, NFSe, Apple/Google Wallet, PWA equipe, importação CSV — ver spec §4.

---

## 5. Comandos VPS (referência histórica)

```bash
cd /opt/eventosbr

# Deploy oficial (após merge na main)
bash scripts/atualizar-vps-agora.sh

# Teste split mock (não use python3 na raiz)
bash scripts/test-sandbox-compra-split.sh

# Verificar produção
bash scripts/verify-production.sh
bash scripts/verificar-versao-site.sh

# Confirmar fix rodapé
curl -s https://eventosbr.app.br/auth | grep -o 'eventosbr-shell-layout\|eventosbr-early-scroll-reset'
```

---

## 6. Correções daquele ciclo (jul/2026)

- CI: testes alinhados às mensagens "conta de recebimento"
- Rodapé: flex shell + CSS crítico + `EarlyScrollReset`
- Wallet: `POST /api/organizador/asaas/wallet/consultar`
- Spec v1.1 + checklist publicação atualizados
- Script VPS para pytest mock dentro do Docker
