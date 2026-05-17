# Encaminha webhooks Stripe (modo test) para a API local.
# Requer Stripe CLI: https://stripe.com/docs/stripe-cli
# Uso: .\scripts\stripe-webhook-dev.ps1
# Copie o whsec_... exibido para STRIPE_WEBHOOK_SECRET no .env e reinicie a API.

$ErrorActionPreference = "Stop"
$apiUrl = if ($env:STRIPE_WEBHOOK_FORWARD_URL) { $env:STRIPE_WEBHOOK_FORWARD_URL } else { "http://127.0.0.1:8000/api/webhooks/stripe" }

Write-Host "Encaminhando eventos Stripe para: $apiUrl"
Write-Host "Copie o signing secret (whsec_...) para STRIPE_WEBHOOK_SECRET no .env"
Write-Host ""

stripe listen --forward-to $apiUrl
