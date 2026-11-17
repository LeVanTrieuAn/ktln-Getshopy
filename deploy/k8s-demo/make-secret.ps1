<#
.SYNOPSIS
    Sinh Secret "server-env" cho demo Kubernetes từ cấu hình production — KHÔNG in giá trị nào.

.DESCRIPTION
    Lấy env của service `server` đúng như Docker Compose đưa cho container production
    (`docker compose config --format json` đã giải .env và mọi ${VAR}), rồi:
      - DATABASE_URL / DIRECT_URL: đổi host `postgres` (tên service trong mạng compose) thành
        host.docker.internal + cổng Postgres đang publish ra máy host, thêm
        connection_limit=<PgPoolPerPod> để 4 pod demo không chiếm hết kết nối Postgres production.
      - JWT_SECRET: sinh NGẪU NHIÊN cho demo (giữ nguyên nếu Secret đã có) — token của demo và
        của production không dùng lẫn được cho nhau.
      - Chỉ chép thêm vài khoá cấu hình không bí mật trong $PassThroughKeys. Không chép khoá
        SePay, SMTP, VietQR, khoá API AI trả phí, MinIO...: demo không cần, không đưa vào etcd.
    Secret đi vào kubectl qua stdin (không qua dòng lệnh, không ghi file tạm).

    Chạy độc lập hoặc được demo.ps1 gọi ở bước apply. Chạy lại an toàn (server-side apply).

.PARAMETER ProjectDir
    Thư mục gốc repo có .env và docker-compose.yml của production. Mặc định: hai cấp trên
    thư mục script (đúng khi chạy từ repo chính). Chạy từ worktree thì truyền đường dẫn repo chính.

.PARAMETER DryRun
    Chỉ đọc cấu hình và in TÊN các khoá sẽ ghi, không gọi kubectl.

.EXAMPLE
    .\make-secret.ps1 -ProjectDir "C:\Users\AD\Desktop\TDTU 2023-2024\KLTN\ktln-Getshopy" -DryRun
#>
[CmdletBinding()]
param(
    [string]$ProjectDir = '',
    [string]$Context = 'docker-desktop',
    [string]$Namespace = 'getshopy-demo',
    [string]$SecretName = 'server-env',
    [ValidateRange(1, 50)]
    [int]$PgPoolPerPod = 5,
    [string]$HostAddress = 'host.docker.internal',
    [switch]$DryRun
)

$ErrorActionPreference = 'Stop'

# Khoá cấu hình KHÔNG bí mật được chép nguyên từ env production (có thì chép, không có thì bỏ).
# Thêm khoá vào đây khi server bắt đầu đọc biến mới mà demo cần.
$PassThroughKeys = @(
    'NODE_ENV', 'BUSINESS_TZ', 'CLICKHOUSE_DB', 'CH_QUERY_TIMEOUT_MS',
    # Job đóng đơn quá hạn chạy trong mọi bản server (khoá advisory nên mỗi lúc chỉ một bản
    # làm) — pod demo phải quét cùng nhịp với production.
    'PAYMENT_EXPIRE_SCAN_INTERVAL_SECONDS',
    'AI_REC_BEHAVIOR_WINDOW_HOURS', 'AI_REC_BEHAVIOR_MAX_EVENTS', 'AI_REC_BEHAVIOR_MIN_DWELL_SECONDS'
)

$utf8 = New-Object System.Text.UTF8Encoding $false

function Get-Prop($Object, [string]$Name) {
    if ($null -eq $Object) { return $null }
    $p = $Object.PSObject.Properties[$Name]
    if ($null -eq $p) { return $null }
    return $p.Value
}

function Get-PublishedPort($Config, [string]$Service, [int]$Target) {
    $svc = Get-Prop (Get-Prop $Config 'services') $Service
    foreach ($port in @(Get-Prop $svc 'ports')) {
        if ($null -ne $port -and [int](Get-Prop $port 'target') -eq $Target -and (Get-Prop $port 'published')) {
            return [int](Get-Prop $port 'published')
        }
    }
    return $null
}

function Convert-DbUrl([string]$Url, [int]$Port, [int]$Pool) {
    # Phần trước '@' cuối cùng là user:pass — giữ nguyên, không in ra.
    $m = [regex]::Match($Url, '^(?<pre>postgres(?:ql)?://.+@)(?<host>[^@:/?#]+)(?::(?<port>\d+))?(?<path>/[^?#]*)?(?<query>\?[^#]*)?$')
    if (-not $m.Success) {
        throw 'DATABASE_URL/DIRECT_URL không có dạng postgresql://user:pass@host:port/db (giá trị không in ra).'
    }
    $hostName = $m.Groups['host'].Value
    if ($hostName -ne 'postgres') {
        throw "Host trong DATABASE_URL là '$hostName', không phải service 'postgres' của compose — script chỉ biết đổi trường hợp đó."
    }
    $query = $m.Groups['query'].Value
    if ($Pool -gt 0 -and $query -notmatch '(^\?|&)connection_limit=') {
        if ($query) { $query += "&connection_limit=$Pool" } else { $query = "?connection_limit=$Pool" }
    }
    return $m.Groups['pre'].Value + $HostAddress + ':' + $Port + $m.Groups['path'].Value + $query
}

function To-Base64([string]$Value) {
    return [Convert]::ToBase64String($utf8.GetBytes($Value))
}

# ── 1. Cấu hình production đã giải ───────────────────────────────────────────────
if (-not $ProjectDir) {
    $ProjectDir = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
}
foreach ($f in '.env', 'docker-compose.yml') {
    if (-not (Test-Path -LiteralPath (Join-Path $ProjectDir $f))) {
        throw "Không thấy $f trong '$ProjectDir'. Chạy lại với -ProjectDir <thư mục gốc repo production>."
    }
}

Write-Host "Đọc env của service server: docker compose --project-directory `"$ProjectDir`" config (không in giá trị)"
# Đọc stdout của docker theo UTF-8; mặc định PowerShell 5.1 đọc theo code page OEM và làm hỏng
# ký tự tiếng Việt trong giá trị.
# ErrorActionPreference = Continue trong lúc gọi lệnh ngoài: cảnh báo trên stderr không làm dừng
# script; kết quả kiểm bằng exit code.
$prevConsole = [Console]::OutputEncoding
$prevEap = $ErrorActionPreference
try {
    [Console]::OutputEncoding = $utf8
    $ErrorActionPreference = 'Continue'
    $lines = & docker compose --project-directory $ProjectDir config --format json
    $exit = $LASTEXITCODE
} finally {
    $ErrorActionPreference = $prevEap
    [Console]::OutputEncoding = $prevConsole
}
if ($exit -ne 0) { throw "docker compose config thất bại (exit $exit)." }
$config = ($lines -join "`n") | ConvertFrom-Json
$lines = $null

$serverEnv = Get-Prop (Get-Prop (Get-Prop $config 'services') 'server') 'environment'
if ($null -eq $serverEnv) { throw 'Không thấy services.server.environment trong cấu hình compose.' }

$pgPort = Get-PublishedPort $config 'postgres' 5432
if (-not $pgPort) { throw 'Postgres không publish cổng 5432 ra máy host — pod không có đường tới DB.' }
$chPort = Get-PublishedPort $config 'clickhouse' 8123
if ($chPort -and $chPort -ne 8123) {
    Write-Warning "ClickHouse publish cổng $chPort, nhưng manifests/10-configmap.yaml trỏ 8123 — sửa CLICKHOUSE_HOST ở đó."
}

# ── 2. Dựng dữ liệu Secret (base64) ─────────────────────────────────────────────
$data = [ordered]@{}

$dbUrl = [string](Get-Prop $serverEnv 'DATABASE_URL')
if (-not $dbUrl) { throw 'Env của server thiếu DATABASE_URL.' }
$data['DATABASE_URL'] = To-Base64 (Convert-DbUrl $dbUrl $pgPort $PgPoolPerPod)
$directUrl = [string](Get-Prop $serverEnv 'DIRECT_URL')
if ($directUrl) {
    # DIRECT_URL chỉ Prisma CLI dùng (pod demo không chạy migrate) — giữ cho khớp schema.prisma.
    $data['DIRECT_URL'] = To-Base64 (Convert-DbUrl $directUrl $pgPort 0)
}
$dbUrl = $null; $directUrl = $null

$jwtNote = 'giữ nguyên từ Secret đang có'
$existingJwt = ''
if (-not $DryRun) {
    $prevEap = $ErrorActionPreference
    $ErrorActionPreference = 'SilentlyContinue'
    try {
        $existingJwt = & kubectl --context $Context -n $Namespace get secret $SecretName -o 'jsonpath={.data.JWT_SECRET}' 2>$null
        if ($LASTEXITCODE -ne 0) { $existingJwt = '' }
    } finally {
        $ErrorActionPreference = $prevEap
    }
}
if ($existingJwt) {
    # Giữ nguyên để pod khởi động trước và sau lần chạy này cùng một khoá ký token.
    $data['JWT_SECRET'] = [string]$existingJwt
} else {
    $bytes = New-Object byte[] 48
    $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    $rng.GetBytes($bytes)
    $rng.Dispose()
    $data['JWT_SECRET'] = To-Base64 ([Convert]::ToBase64String($bytes))
    $jwtNote = 'sinh ngẫu nhiên cho demo, khác production'
}
$existingJwt = $null

$copied = @()
foreach ($key in $PassThroughKeys) {
    $value = Get-Prop $serverEnv $key
    if ($null -ne $value -and [string]$value -ne '') {
        $data[$key] = To-Base64 ([string]$value)
        $copied += $key
    }
}
$serverEnv = $null; $config = $null

Write-Host ("Postgres cho pod: {0}:{1} (pool tối đa {2} kết nối / pod)" -f $HostAddress, $pgPort, $PgPoolPerPod)
Write-Host ("JWT_SECRET: {0}" -f $jwtNote)
Write-Host ("Khoá trong Secret {0}/{1}: {2}" -f $Namespace, $SecretName, (@($data.Keys) -join ', '))
if ($DryRun) {
    Write-Host '-DryRun: không ghi gì vào cluster.'
    return
}

# ── 3. Ghi vào cluster qua stdin ─────────────────────────────────────────────────
$ctxs = & kubectl config get-contexts -o name
if (@($ctxs) -notcontains $Context) {
    throw "Chưa có context '$Context' — Kubernetes của Docker Desktop chưa bật (README, mục Bật Kubernetes)."
}
$prevEap = $ErrorActionPreference
$ErrorActionPreference = 'SilentlyContinue'
& kubectl --context $Context get namespace $Namespace 2>$null | Out-Null
$nsExit = $LASTEXITCODE
$ErrorActionPreference = $prevEap
if ($nsExit -ne 0) {
    $ErrorActionPreference = 'Continue'
    & kubectl --context $Context apply -f (Join-Path $PSScriptRoot 'manifests\00-namespace.yaml')
    $nsExit = $LASTEXITCODE
    $ErrorActionPreference = $prevEap
    if ($nsExit -ne 0) { throw "Không tạo được namespace $Namespace." }
}

$sb = New-Object System.Text.StringBuilder
[void]$sb.AppendLine('apiVersion: v1')
[void]$sb.AppendLine('kind: Secret')
[void]$sb.AppendLine('metadata:')
[void]$sb.AppendLine("  name: $SecretName")
[void]$sb.AppendLine("  namespace: $Namespace")
[void]$sb.AppendLine('  labels:')
[void]$sb.AppendLine('    app.kubernetes.io/part-of: getshopy-demo')
[void]$sb.AppendLine('    app.kubernetes.io/managed-by: make-secret.ps1')
[void]$sb.AppendLine('type: Opaque')
[void]$sb.AppendLine('data:')
foreach ($key in $data.Keys) {
    [void]$sb.AppendLine(("  {0}: {1}" -f $key, $data[$key]))
}
$data = $null

# Server-side apply: không lưu thêm bản sao Secret vào annotation last-applied-configuration
# như apply thường; script là chủ duy nhất của object này nên --force-conflicts.
$prevOut = $OutputEncoding
$prevEap = $ErrorActionPreference
try {
    $OutputEncoding = $utf8
    $ErrorActionPreference = 'Continue'
    $sb.ToString() | & kubectl --context $Context apply --server-side --force-conflicts --field-manager=make-secret -f -
    $exit = $LASTEXITCODE
} finally {
    $ErrorActionPreference = $prevEap
    $OutputEncoding = $prevOut
    [void]$sb.Clear()
}
if ($exit -ne 0) { throw "kubectl apply Secret thất bại (exit $exit)." }
Write-Host 'Pod chỉ đọc Secret lúc khởi động — Deployment đã chạy thì: kubectl -n getshopy-demo rollout restart deployment/server'
