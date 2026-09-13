# scripts/setup-dbt.ps1
# Đi lên 1 cấp để tìm .env (vì script trong thư mục scripts/)

$projectRoot = Split-Path $PSScriptRoot -Parent
$envFile = Join-Path $projectRoot ".env"

if (Test-Path $envFile) {
    Get-Content $envFile | ForEach-Object {
        if ($_ -match '^(.+?)=(.+)$') {
            [Environment]::SetEnvironmentVariable($matches[1], $matches[2], 'Process')
        }
    }
    Write-Host "✓ Environment variables loaded from $envFile"
} else {
    Write-Host "✗ .env file not found at $envFile"
}