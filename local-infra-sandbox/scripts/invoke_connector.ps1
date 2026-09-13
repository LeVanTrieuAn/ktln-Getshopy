param(
    [Parameter(Mandatory=$true)][string]$ConfigFile,
    [string]$Url = 'http://localhost:8083/connectors'
)

$ErrorActionPreference = 'Stop'

if (-not (Test-Path $ConfigFile)) {
    Write-Error "Config file not found: $ConfigFile"
}

$scriptDir = Split-Path -Parent $ConfigFile
$envFile = Join-Path $scriptDir '..\.env'
if (-not (Test-Path $envFile)) {
    $envFile = Join-Path (Get-Location) '.env'
}

$envLookup = @{}
if (Test-Path $envFile) {
    Get-Content -Path $envFile | ForEach-Object {
        $line = $_.Trim()
        if ($line -and $line -notmatch '^\s*#') {
            if ($line -match '^\s*([^=\s][^=]*)\s*=\s*(.*)?\s*$') {
                $name = $matches[1].Trim()
                $value = $matches[2].Trim()
                if ($value.Length -ge 2 -and $value[0] -eq '"' -and $value[-1] -eq '"') {
                    $value = $value.Substring(1, $value.Length - 2)
                }
                $envLookup[$name] = $value
                [System.Environment]::SetEnvironmentVariable($name, $value, 'Process')
            }
        }
    }
}

function Get-EnvValue {
    param([string]$Key)
    if ($envLookup.ContainsKey($Key)) { return $envLookup[$Key] }
    $value = Get-Item -Path ("Env:" + $Key) -ErrorAction SilentlyContinue
    if ($value) { return $value.Value }
    return ''
}

$body = Get-Content -Path $ConfigFile -Raw
$body = [regex]::Replace($body, '\$\{([^}]+)\}', {
    param($m)
    $key = $m.Groups[1].Value
    return Get-EnvValue -Key $key
})

try {
    $response = Invoke-RestMethod -Method Post -Uri $Url -ContentType 'application/json' -Body $body
    $response | ConvertTo-Json -Depth 10
}
catch {
    Write-Host ('ERROR: ' + $_) -ForegroundColor Red
    Write-Host ('Response: ' + $_.ErrorDetails.Message) -ForegroundColor Yellow
    exit 1
}
