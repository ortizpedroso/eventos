# Sobe stack E2E (API com ASAAS_E2E_MOCK + Postgres + Next).
# Uso: .\scripts\e2e-up.ps1

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

docker compose -p eventosbr-e2e -f docker-compose.e2e.yml up -d --build --wait
Write-Host ""
Write-Host "Stack E2E pronta. Teste compra:" -ForegroundColor Green
Write-Host "  cd frontend" -ForegroundColor Yellow
Write-Host "  `$env:PLAYWRIGHT_SKIP_WEBSERVER='1'" -ForegroundColor Yellow
Write-Host "  npm run test:e2e:compra" -ForegroundColor Yellow
