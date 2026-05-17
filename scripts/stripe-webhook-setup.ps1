# Obtém o whsec do Stripe CLI e grava em STRIPE_WEBHOOK_SECRET no .env
# Uso: .\scripts\stripe-webhook-setup.ps1
# Depois: docker compose restart api  (se usar Docker)
#         .\scripts\stripe-webhook-dev.ps1  (em outro terminal, deixe rodando)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$envFile = Join-Path $root ".env"

if (-not (Get-Command stripe -ErrorAction SilentlyContinue)) {
    Write-Host "ERRO: Stripe CLI nao encontrado." -ForegroundColor Red
    Write-Host "Instale: https://stripe.com/docs/stripe-cli#install"
    Write-Host "Depois: stripe login"
    exit 1
}

Write-Host "Obtendo webhook signing secret (stripe listen --print-secret)..." -ForegroundColor Cyan
$out = stripe listen --print-secret 2>&1 | Out-String
$whsec = $null
foreach ($line in ($out -split "`n")) {
    if ($line -match "(whsec_[a-zA-Z0-9]+)") {
        $whsec = $Matches[1]
        break
    }
}
if (-not $whsec) {
    Write-Host $out
    Write-Host "ERRO: nao encontrei whsec_ na saida do Stripe CLI." -ForegroundColor Red
    exit 1
}

Write-Host "Secret: $whsec" -ForegroundColor Green

if (-not (Test-Path $envFile)) {
    Copy-Item (Join-Path $root ".env.example") $envFile
    Write-Host "Criado .env a partir de .env.example"
}

$content = Get-Content $envFile -Raw
if ($content -match "(?m)^STRIPE_WEBHOOK_SECRET=.*$") {
    $content = $content -replace "(?m)^STRIPE_WEBHOOK_SECRET=.*$", "STRIPE_WEBHOOK_SECRET=$whsec"
} else {
    $content = $content.TrimEnd() + "`nSTRIPE_WEBHOOK_SECRET=$whsec`n"
}
Set-Content -Path $envFile -Value $content -NoNewline
Add-Content -Path $envFile -Value "" 

Write-Host ""
Write-Host "Atualizado: $envFile" -ForegroundColor Green
Write-Host ""
Write-Host "Proximos passos:" -ForegroundColor Yellow
Write-Host "  1. docker compose up -d api   (recarrega .env; restart sozinho nao basta)"
Write-Host "  2. Terminal A: .\scripts\stripe-webhook-dev.ps1"
Write-Host "  3. Terminal B: python scripts/compra_teste_stripe.py"
Write-Host ""
