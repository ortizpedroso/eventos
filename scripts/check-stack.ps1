# Diagnostico rapido (Windows PowerShell) - API + front local
$ErrorActionPreference = "Continue"
Write-Host "=== EventosBR - diagnostico ===" -ForegroundColor Cyan

function Test-Url($name, $url) {
  try {
    $r = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 5
    Write-Host "[OK] $name ($($r.StatusCode)) $url" -ForegroundColor Green
  } catch {
    Write-Host "[FALHA] $name $url" -ForegroundColor Red
    Write-Host "       $($_.Exception.Message)" -ForegroundColor DarkRed
  }
}

Test-Url "API liveness (/health)" "http://127.0.0.1:8000/health"
try {
  $r = Invoke-WebRequest -Uri "http://127.0.0.1:8000/ready" -UseBasicParsing -TimeoutSec 5
  if ($r.StatusCode -eq 200) {
    Write-Host "[OK] API readiness (/ready) (200)" -ForegroundColor Green
  } else {
    Write-Host "[AVISO] API readiness (/ready) ($($r.StatusCode))" -ForegroundColor Yellow
  }
} catch {
  Write-Host "[FALHA] API readiness (/ready) — BD ou API indisponível (esperado 200)" -ForegroundColor Red
  Write-Host "       $($_.Exception.Message)" -ForegroundColor DarkRed
}
Test-Url "Front" "http://127.0.0.1:3000/"

Write-Host ""
Write-Host "Se a API falhar: na raiz do repo, ative o venv e execute:" -ForegroundColor Yellow
Write-Host "  uvicorn app.main:app --host 127.0.0.1 --port 8000" -ForegroundColor Gray
Write-Host "Se o front falhar: na pasta frontend:" -ForegroundColor Yellow
Write-Host "  npm run dev" -ForegroundColor Gray
Write-Host "Com Docker: docker compose up --build" -ForegroundColor Yellow
Write-Host 'Guia: ver TROUBLESHOOTING.md - secao Site fora do ar' -ForegroundColor Cyan
