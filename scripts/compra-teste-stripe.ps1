# Atalho PowerShell para compra de teste com Stripe + webhook
# Uso: .\scripts\compra-teste-stripe.ps1

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root
python scripts/compra_teste_stripe.py
exit $LASTEXITCODE
