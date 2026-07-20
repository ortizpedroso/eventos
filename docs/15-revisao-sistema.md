# 15 — Revisão do sistema (snapshot)

**Data:** 2026-07-16  
**Base:** branch `main` (commit `12b8ecf`)  
**Spec:** [`specs/eventosbr-producao.md`](../specs/eventosbr-producao.md)

---

## Resumo executivo

| Área | Nota | Comentário |
|------|------|------------|
| Pagamentos Asaas + split | ✅ | Motor em `pagamento_asaas.py`; taxa na conta emissora |
| Onboarding organizador (`linked`) | ✅ | Vínculo wallet + validação ≠ plataforma |
| UX produto / conta | ✅ | Checkout, vitrine, financeiro, portaria |
| Segurança (auditoria 2026) | ✅ | CSP, proxy admin, rate limit, e-mail verificado |
| Testes automatizados | ✅ | 204 pytest + CI (api, web, e2e, e2e-compra, e2e-asaas) |
| Go-live VPS | 🔧 | `.env` produção, webhook, SMTP, wallet organizador real |

---

## Pagamentos e repasse

- **Split:** apenas o wallet do **organizador** entra no array `split`; a **taxa EventosBR** fica na conta que emite a cobrança (plataforma).
- **Bloqueios:** venda sem wallet aprovado; wallet igual a `ASAAS_PLATFORM_WALLET_ID` rejeitado.
- **Sandbox:** scripts `ir-sandbox-asaas.sh` / `voltar-producao-asaas.sh`; teste de compra+split: `test-sandbox-compra-split.sh` (requer `ASAAS_ORGANIZER_API_KEY` de conta secundária).

---

## Testes relevantes

| Tipo | Onde |
|------|------|
| Unitário split / webhook | `tests/test_pagamentos_asaas.py` |
| Fluxo compra mock (split distinto) | `tests/test_compra_split_fluxo_mock.py` |
| E2E browser Asaas mock | `frontend/e2e/compra-checkout-asaas.spec.ts` |
| Integração sandbox real (opcional) | `RUN_ASAAS_SANDBOX_INTEGRATION=1` → `tests/test_sandbox_compra_split_integration.py` |

---

## Pendências operacionais (não são bug de código)

1. Segunda conta **sandbox.asaas.com** para organizador de teste.
2. `ASAAS_ORGANIZER_API_KEY` no `.env.asaas-sandbox-pending`.
3. Backup de produção com `$aact_prod_...` antes de ficar só em sandbox.
4. PRs em aberto (ex.: UX “Buscar wallet” por API key) — merge recomendado.

---

## Comandos rápidos

```bash
python3 -m pytest tests/ -q
bash scripts/test-sandbox-compra-split.sh   # VPS em sandbox + API no ar
```
