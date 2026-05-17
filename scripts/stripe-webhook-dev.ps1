# Encaminha webhooks Stripe (modo test) para a API local.
# Requer: stripe login + STRIPE_WEBHOOK_SECRET no .env (use stripe-webhook-setup.ps1)
#
# Uso: .\scripts\stripe-webhook-dev.ps1
# Deixe este terminal aberto enquanto testa compras.

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$envFile = Join-Path $root ".env"
$apiUrl = if ($env:STRIPE_WEBHOOK_FORWARD_URL) { $env:STRIPE_WEBHOOK_FORWARD_URL } else { "http://127.0.0.1:8000/api/webhooks/stripe" }

if (-not (Get-Command stripe -ErrorAction SilentlyContinue)) {
    Write-Host "ERRO: Stripe CLI nao encontrado. https://stripe.com/docs/stripe-cli" -ForegroundColor Red
    exit 1
}

$whsec = $null
if (Test-Path $envFile) {
    foreach ($line in Get-Content $envFile) {
        if ($line -match "^STRIPE_WEBHOOK_SECRET=(.+)$") {
            $whsec = $Matches[1].Trim().Trim('"')
            break
        }
    }
}

if (-not $whsec -or $whsec -eq "" -or $whsec -match "whsec_\.\.\.|seu_webhook") {
    Write-Host "STRIPE_WEBHOOK_SECRET nao configurado no .env" -ForegroundColor Yellow
    Write-Host "Execute primeiro: .\scripts\stripe-webhook-setup.ps1" -ForegroundColor Yellow
    Write-Host ""
}

Write-Host "========================================" -ForegroundColor Cyan
Write-Host " Stripe webhook -> EventosBR (modo test)" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Destino:  $apiUrl"
Write-Host "Eventos:  payment_intent.succeeded, payment_intent.payment_failed"
Write-Host ""
Write-Host "Mantenha este terminal aberto." -ForegroundColor Yellow
Write-Host "Em outro terminal: python scripts/compra_teste_stripe.py" -ForegroundColor Yellow
Write-Host ""

stripe listen --forward-to $apiUrl --events payment_intent.succeeded,payment_intent.payment_failed
