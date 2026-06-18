# Executa teste E2E de compra (requer stack e2e ou API em :8000 com ASAAS_E2E_MOCK).
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location (Join-Path $root "frontend")

$env:PLAYWRIGHT_SKIP_WEBSERVER = "1"
$env:PLAYWRIGHT_BASE_URL = if ($env:PLAYWRIGHT_BASE_URL) { $env:PLAYWRIGHT_BASE_URL } else { "http://127.0.0.1:3000" }
$env:PLAYWRIGHT_API_URL = if ($env:PLAYWRIGHT_API_URL) { $env:PLAYWRIGHT_API_URL } else { "http://127.0.0.1:8000" }

npm run test:e2e:compra
exit $LASTEXITCODE
