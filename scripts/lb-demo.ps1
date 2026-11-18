<#
.SYNOPSIS
    Demo cân bằng tải bằng Docker Compose: N bản server sau nginx gateway (18/11/2026).

.DESCRIPTION
    Ba phần:
      (a) 30 request GET /api/health qua cổng loopback của gateway (mặc định
          http://localhost:18000), đếm số request mỗi bản server trả lời (header X-Served-By).
      (b) Với N = 1, 2, 3: scale service server về N bản, chờ healthy, chạy k6 (container
          grafana/k6 trong network của compose, gọi thẳng http://gateway), lưu tóm tắt JSON
          theo từng N, in bảng N | req/s | p95 | tỷ lệ lỗi.
      (c) Trả số bản về SERVER_REPLICAS của compose (mặc định 3) — luôn chạy, kể cả khi lỗi.

    CHỈ endpoint ĐỌC công khai (danh sách, chi tiết sản phẩm, danh mục, health): không đăng
    nhập, không ghi, không đặt hàng. Nhưng bài tải chạy trên Postgres/Redis THẬT của stack đang
    chạy và lúc scale về 1 bản thì một bản gánh toàn bộ khách thật — chạy lúc vắng khách.

      .\scripts\lb-demo.ps1                    # cả ba phần, hỏi xác nhận trước khi scale
      .\scripts\lb-demo.ps1 -Yes -Rate 300     # không hỏi, 300 request/giây
      .\scripts\lb-demo.ps1 -SkipLoad          # chỉ phần (a)

    Chi tiết: docs/load-balancing.md

.PARAMETER Rate
    Request/giây cố định của k6 (constant-arrival-rate). Muốn thấy khác biệt giữa 1/2/3 bản thì
    Rate phải VƯỢT sức một bản: chạy thử -Replicas 1 với vài mức, chọn mức mà p95 bắt đầu tăng
    vọt hoặc có dropped_iterations.
#>
[CmdletBinding()]
param(
    [int[]]$Replicas = @(1, 2, 3),
    [ValidateRange(1, 5000)]
    [int]$Rate = 200,
    [string]$Duration = '60s',
    [string]$Warmup = '15s',
    [int]$MaxVus = 300,
    # Gateway qua cổng loopback trên máy (GATEWAY_SERVE_PORT trong compose, mặc định 18000)
    [string]$BaseUrl = 'http://localhost:18000',
    [string]$K6Image = 'grafana/k6:1.8.2',
    # Trần CPU / RAM cho container k6 — bộ sinh tải không được giành hết máy đang chạy production
    [string]$K6Cpus = '2',
    [string]$K6Memory = '1g',
    [int]$HealthyTimeoutSec = 300,
    [string]$OutDir = '',
    [switch]$SkipLoad,
    [switch]$Yes
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

$Root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$LoadDir = Join-Path $PSScriptRoot 'loadtest'
if (-not $OutDir) { $OutDir = Join-Path $LoadDir ('results\' + (Get-Date -Format 'yyyyMMdd-HHmmss')) }

function Write-Title([string]$Text) { Write-Host ''; Write-Host "=== $Text ===" -ForegroundColor Cyan }
function Write-Cmd([string]$Text) { Write-Host "PS> $Text" -ForegroundColor DarkGray }
function Write-Note([string]$Text) { Write-Host $Text -ForegroundColor Gray }
function Write-Good([string]$Text) { Write-Host $Text -ForegroundColor Green }
function Write-Warn([string]$Text) { Write-Host "!! $Text" -ForegroundColor Yellow }

# PowerShell 5.1 biến stderr của lệnh ngoài thành lỗi khi ErrorActionPreference = Stop (docker
# compose ghi tiến trình ra stderr) -> hạ xuống Continue trong lúc gọi, kiểm $LASTEXITCODE.
function Invoke-Docker {
    param([Parameter(ValueFromRemainingArguments = $true)][string[]]$DockerArgs)
    Write-Cmd ('docker ' + ($DockerArgs -join ' '))
    $prev = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try {
        & docker @DockerArgs
        if ($LASTEXITCODE -ne 0) { throw "docker $($DockerArgs[0]) thoát mã $LASTEXITCODE" }
    } finally {
        $ErrorActionPreference = $prev
    }
}

function Get-DockerOut {
    param([Parameter(ValueFromRemainingArguments = $true)][string[]]$DockerArgs)
    $prev = $ErrorActionPreference
    $ErrorActionPreference = 'SilentlyContinue'
    try {
        $out = & docker @DockerArgs 2>$null
        if ($LASTEXITCODE -ne 0) { return @() }
        return @($out | Where-Object { $_ -and $_.Trim() } | ForEach-Object { $_.Trim() })
    } finally {
        $ErrorActionPreference = $prev
    }
}

# Một request, trả về tên bản trả lời (X-Served-By) hoặc chuỗi lỗi. 503 khi server đang tắt
# êm vẫn mang header, nên đọc header cả trong nhánh lỗi.
function Get-ServedBy([string]$Url) {
    try {
        $r = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 5
        $name = [string]$r.Headers['X-Served-By']
        if (-not $name) { $name = '(không có X-Served-By — SERVED_BY_HEADER=0?)' }
        return [pscustomobject]@{ Status = [int]$r.StatusCode; ServedBy = $name }
    } catch {
        $resp = $_.Exception.Response
        if ($resp) {
            $name = [string]$resp.Headers['X-Served-By']
            return [pscustomobject]@{ Status = [int]$resp.StatusCode; ServedBy = $(if ($name) { $name } else { '(lỗi, không có header)' }) }
        }
        return [pscustomobject]@{ Status = 0; ServedBy = "(lỗi kết nối: $($_.Exception.Message))" }
    }
}

function Show-Distribution([int]$Count) {
    $url = "$BaseUrl/api/health"
    Write-Note "GET $url x $Count"
    $res = 1..$Count | ForEach-Object { Get-ServedBy $url }
    $res | Group-Object ServedBy | Sort-Object Name | ForEach-Object {
        [pscustomobject]@{ 'Bản (X-Served-By)' = $_.Name; 'Số request' = $_.Count; 'Mã HTTP' = (($_.Group | Select-Object -ExpandProperty Status -Unique) -join ',') }
    } | Format-Table -AutoSize | Out-Host
    return $res
}

# Id 12 ký tự của các container server đang chạy = hostname = giá trị X-Served-By
function Get-ServerIds {
    $ids = Get-DockerOut compose ps -q server
    return @($ids | ForEach-Object { $_.Substring(0, 12) })
}

function Wait-Healthy([int]$N) {
    $deadline = (Get-Date).AddSeconds($HealthyTimeoutSec)
    while ((Get-Date) -lt $deadline) {
        $ids = Get-ServerIds
        $states = @($ids | ForEach-Object { (Get-DockerOut inspect -f '{{.State.Health.Status}}' $_) -join '' })
        $healthy = @($states | Where-Object { $_ -eq 'healthy' }).Count
        Write-Note ("  {0:HH:mm:ss}  {1}/{2} bản healthy ({3})" -f (Get-Date), $healthy, $N, ($states -join ', '))
        if ($ids.Count -eq $N -and $healthy -eq $N) { return $ids }
        Start-Sleep -Seconds 5
    }
    throw "Quá $HealthyTimeoutSec s mà chưa đủ $N bản healthy — xem: docker compose logs server"
}

# nginx phân giải lại tên `server` mỗi 10 s (resolver valid=10s): chờ tới khi gateway thấy đủ N bản.
function Wait-GatewaySees([string[]]$Ids) {
    $deadline = (Get-Date).AddSeconds(30)
    while ((Get-Date) -lt $deadline) {
        $seen = @(1..(6 * $Ids.Count) | ForEach-Object { (Get-ServedBy "$BaseUrl/api/health").ServedBy } | Sort-Object -Unique)
        $missing = @($Ids | Where-Object { $seen -notcontains $_ })
        if ($missing.Count -eq 0) { Write-Good "  gateway đã chia cho đủ $($Ids.Count) bản"; return }
        Start-Sleep -Seconds 2
    }
    Write-Warn 'Sau 30 s gateway vẫn chưa thấy đủ bản — vẫn chạy k6, xem cột phân bố trong kết quả.'
}

function Get-Metric($Summary, [string]$Name, [string]$Key) {
    $p = $Summary.metrics.PSObject.Properties[$Name]
    if (-not $p) { return $null }
    $v = $p.Value.values.PSObject.Properties[$Key]
    if (-not $v) { return $null }
    return [double]$v.Value
}

function Get-Seconds([string]$D) {
    if ($D -match '^(\d+(\.\d+)?)s$') { return [double]$Matches[1] }
    if ($D -match '^(\d+(\.\d+)?)m$') { return [double]$Matches[1] * 60 }
    throw "Duration '$D' phải có dạng 60s hoặc 2m"
}

# ─── Chuẩn bị ──────────────────────────────────────────────────────────────────
Push-Location $Root
try {
    $network = (Get-DockerOut compose ps -q gateway | Select-Object -First 1)
    if (-not $network) { throw 'gateway chưa chạy (docker compose ps gateway). Demo đi qua gateway — bật stack trước.' }
    $network = (Get-DockerOut inspect -f '{{range $k, $v := .NetworkSettings.Networks}}{{$k}} {{end}}' $network) -join ' '
    $network = ($network -split ' ' | Where-Object { $_ } | Select-Object -First 1)
    $before = (Get-ServerIds).Count

    Write-Title 'Demo cân bằng tải — Docker Compose + nginx'
    Write-Note "Thư mục compose : $Root"
    Write-Note "Network         : $network"
    Write-Note "Bản server hiện : $before"
    if (-not $SkipLoad) {
        Write-Note "Sẽ scale server : $($Replicas -join ' -> '), mỗi mức k6 $Rate req/s, khởi động $Warmup + đo $Duration"
        Write-Note "Kết quả lưu ở   : $OutDir"
        Write-Warn 'Bài tải chạy trên Postgres/Redis THẬT; lúc 1 bản thì một bản gánh cả khách thật. Chạy lúc vắng khách.'
        if (-not $Yes) {
            $ans = Read-Host 'Tiếp tục? (y/N)'
            if ($ans -notmatch '^(y|yes|c|co|có)$') { Write-Note 'Huỷ.'; return }
        }
    }

    # ─── (a) Phân bố request ────────────────────────────────────────────────────
    Write-Title "(a) 30 request /api/health qua gateway — mỗi request do bản nào trả lời"
    $null = Show-Distribution 30
    Write-Note 'nginx: upstream least_conn + keepalive; mỗi REQUEST chọn một bản (L7), không dính theo kết nối.'

    if ($SkipLoad) { return }

    # ─── (b) Tải thử theo số bản ────────────────────────────────────────────────
    New-Item -ItemType Directory -Force -Path $OutDir | Out-Null
    $durS = Get-Seconds $Duration
    $rows = @()
    foreach ($n in $Replicas) {
        Write-Title "(b) N = $n bản"
        Invoke-Docker compose up -d --no-deps --scale "server=$n" server
        $ids = Wait-Healthy $n
        Wait-GatewaySees $ids
        $summaryName = "summary-N$n.json"
        $k6Args = @('run', '--rm', '--network', $network, '--cpus', $K6Cpus, '--memory', $K6Memory,
            '-v', "${LoadDir}:/scripts:ro", '-v', "${OutDir}:/out",
            '-e', 'BASE_URL=http://gateway', '-e', "RATE=$Rate", '-e', "WARMUP=$Warmup", '-e', "DURATION=$Duration",
            '-e', "MAX_VUS=$MaxVus", '-e', "REPLICAS=$($ids -join ',')", '-e', "SUMMARY_PATH=/out/$summaryName",
            $K6Image, 'run', '--quiet', '/scripts/k6-lb.js')
        Write-Cmd ('docker ' + ($k6Args -join ' '))
        $prev = $ErrorActionPreference
        $ErrorActionPreference = 'Continue'
        try { & docker @k6Args; $k6Code = $LASTEXITCODE } finally { $ErrorActionPreference = $prev }
        # 99 = có threshold không đạt (vd p95 vượt P95_MS lúc quá tải) — vẫn là số đo hợp lệ.
        if ($k6Code -eq 99) { Write-Warn "k6: có threshold không đạt ở N = $n (xem JSON) — vẫn ghi vào bảng." }
        elseif ($k6Code -ne 0) { throw "k6 thoát mã $k6Code ở N = $n" }
        $s = Get-Content (Join-Path $OutDir $summaryName) -Raw -Encoding UTF8 | ConvertFrom-Json
        $count = Get-Metric $s 'http_reqs{scenario:steady}' 'count'
        $dist = ($ids | ForEach-Object { '{0}' -f [int](Get-Metric $s "served_by{replica:$_}" 'count') }) -join ' / '
        $rows += [pscustomobject]@{
            'N'          = $n
            'req/s'      = [math]::Round($count / $durS, 1)
            'p95 (ms)'   = [math]::Round((Get-Metric $s 'http_req_duration{scenario:steady}' 'p(95)'), 1)
            'p99 (ms)'   = [math]::Round((Get-Metric $s 'http_req_duration{scenario:steady}' 'p(99)'), 1)
            'lỗi (%)'    = [math]::Round(100 * (Get-Metric $s 'http_req_failed{scenario:steady}' 'rate'), 2)
            'bỏ lượt'    = [int](Get-Metric $s 'dropped_iterations{scenario:steady}' 'count')
            'phân bố'    = $dist
        }
    }

    Write-Title "Kết quả — k6 $Rate req/s cố định, pha đo $Duration"
    $rows | Format-Table -AutoSize | Out-Host
    $rows | ConvertTo-Json | Set-Content -Path (Join-Path $OutDir 'table.json') -Encoding UTF8
    Write-Note "req/s = số request trong pha đo / $durS s. 'bỏ lượt' > 0: k6 hết VU vì server trả chậm = quá tải."
    Write-Note "'phân bố' = số request mỗi bản trả lời (cả pha khởi động), theo thứ tự id container."
    Write-Note "JSON đầy đủ: $OutDir"
} catch {
    Write-Warn $_.Exception.Message
    throw
} finally {
    # ─── (c) Trả số bản về cấu hình compose ─────────────────────────────────────
    if (-not $SkipLoad -and ($Yes -or $ans -match '^(y|yes|c|co|có)$')) {
        Write-Title '(c) Trả số bản về SERVER_REPLICAS của compose'
        try {
            # Không --scale: compose dùng deploy.replicas = ${SERVER_REPLICAS:-3}
            Invoke-Docker compose up -d --no-deps server
            Write-Good "Đã trả về $((Get-ServerIds).Count) bản (trước demo: $before)."
        } catch {
            Write-Warn "Không trả được số bản: $($_.Exception.Message). Chạy tay: docker compose up -d --no-deps server"
        }
    }
    Pop-Location
}
