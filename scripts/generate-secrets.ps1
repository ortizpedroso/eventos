# Gera valores seguros para SECRET_KEY e PLATFORM_ADMIN_API_KEY.
# Uso: .\scripts\generate-secrets.ps1

$ErrorActionPreference = "Stop"

function New-RandomBase64([int]$bytes = 32) {
    $buf = New-Object byte[] $bytes
    [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($buf)
    [Convert]::ToBase64String($buf).TrimEnd('=').Replace('+', '-').Replace('/', '_')
}

$secretKey = New-RandomBase64 48
$adminKey = New-RandomBase64 32
$postgres = -join ((48..57) + (65..90) + (97..122) | Get-Random -Count 32 | ForEach-Object { [char]$_ })

Write-Host "Cole no .env de producao (nao commite):" -ForegroundColor Cyan
Write-Host ""
Write-Host "SECRET_KEY=$secretKey"
Write-Host "PLATFORM_ADMIN_API_KEY=$adminKey"
Write-Host "POSTGRES_PASSWORD=$postgres"
Write-Host ""
Write-Host "Guarde num gestor de senhas. Rotacione se alguma chave vazou." -ForegroundColor Yellow
