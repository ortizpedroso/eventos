# 15 — Revisão do sistema (go-live)

**Atualizado:** 2026-07-20

## Status atual

| Área | Status |
|------|--------|
| pytest | 208 testes passando |
| `npm run build` | OK |
| CI `main` | Corrigido (asserts de mensagens + suite verde) |
| Pagamentos Asaas + split | OK |
| Onboarding padrão | `baas` (subconta); `linked` via `.env` |
| Rodapé | Layout grid `auto 1fr auto` + auth min-height |

## Correções deste ciclo

- CI: testes alinhados às mensagens “conta de recebimento”
- Rodapé: `flex` no `body`, CSS crítico em `globals.css`, `EarlyScrollReset` no `<head>`, scroll restoration manual, skeleton flexível em `/auth`
- Wallet organizador: `POST /api/organizador/asaas/wallet/consultar` + botão “Buscar ID” no Financeiro
- Spec/docs: padrão `ASAAS_ONBOARDING_MODE=baas`
- Teste E2E mock: fluxo compra + split (`test_compra_split_fluxo_mock.py`)

## Pendências operacionais (VPS)

1. `.env` produção com `ASAAS_API_KEY`, `ASAAS_PLATFORM_WALLET_ID`, `ASAAS_WEBHOOK_TOKEN`
2. Webhook ativo no painel Asaas
3. SMTP + DNS (SPF/DKIM)
4. `git pull origin main` + rebuild no VPS
