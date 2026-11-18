<#
.SYNOPSIS
    Demo TRỰC TIẾP trên Grafana: tạo tải đọc qua gateway, rồi scale / làm chết một bản server để
    xem dashboard "Getshopy — Cân bằng tải" thay đổi theo thời gian thực (19/11/2026).

.DESCRIPTION
    Ba kịch bản (-Scenario, mặc định all = steady -> scale -> failover):
      steady    tăng dần tới -Rate request/giây rồi giữ -Minutes phút: các đường request/s của
                từng bản nằm sát nhau, tỷ trọng ~ 100/N %.
      scale     về 1 bản, rồi cứ -StepSec giây lại scale lên 2, 3, 4 (-ScaleSteps) trong lúc tải
                vẫn chạy: đường mới xuất hiện, tỷ trọng chia lại, p95 hạ xuống.
      failover  "1 server chết": trong lúc tải chạy, giết TIẾN TRÌNH CHÍNH của MỘT bản bằng
                kill -9 (như OOM killer / crash thật). Docker thấy container thoát bất thường (137)
                và restart policy của service (`restart: unless-stopped`) TỰ khởi động lại nó —
                không cần Swarm / Kubernetes. Đo: lúc kill, lúc Docker khởi động lại, lúc healthy
                lại, thời gian bản đó vắng mặt, số response lỗi k6 sau sự cố.
                KHÔNG dùng `docker kill` / `docker stop`: Docker coi đó là dừng TAY và bỏ qua
                restart policy (https://docs.docker.com/engine/containers/start-containers-automatically/)
                — bản đó sẽ không tự quay lại, demo sai mục đích.

    k6 (container grafana/k6, trần CPU/RAM) chạy TRONG network của compose và chỉ gọi
    http://gateway, CHỈ endpoint ĐỌC công khai (danh mục, danh sách, chi tiết sản phẩm, health) —
    không đăng nhập, không ghi. Script chỉ đụng service `server` (--no-deps), không bao giờ
    postgres / clickhouse / redis. Số bản server LUÔN được trả về như lúc bắt đầu (finally — kể cả
    khi lỗi hoặc Ctrl+C). Mọi lệnh compose chạy với SERVER_DB_PREP=off như CD: bản server tạo
    thêm lúc scale không chạy script DB nào.

    Tải chạy trên Postgres/Redis THẬT của stack; lúc 1 bản thì một bản gánh cả khách thật —
    chạy lúc vắng khách.

      .\scripts\grafana-demo.ps1                          # cả ba kịch bản, hỏi xác nhận
      .\scripts\grafana-demo.ps1 -Scenario failover -Yes   # chỉ "1 server chết", không hỏi
      .\scripts\grafana-demo.ps1 -Rate 300 -Minutes 2
      .\scripts\grafana-demo.ps1 -DryRun                   # chỉ in lệnh docker / k6, không chạy

    Cần: stack đang chạy (gateway, server) và Prometheus + Grafana:  docker compose up -d prometheus grafana
    Tài liệu: docs/monitoring.md (mục "Kịch bản demo trực tiếp").

.PARAMETER Rate
    Request/giây k6 giữ cố định sau khi tăng dần. Muốn thấy p95 khác nhau giữa 1 và 4 bản thì Rate
    phải VƯỢT sức một bản (chọn bằng lb-demo.ps1 -Replicas 1 vài mức).

.PARAMETER HelperImage
    Image dùng một lần để gửi kill -9 từ PID namespace của máy ảo Docker (--privileged --pid=host).
    Chỉ chạy đúng lệnh `kill -9 <pid>` rồi tự xoá (--rm).

.PARAMETER ComposeOptions
    Tham số thêm cho MỌI lệnh `docker compose` — chỉ để thử script trên một project compose
    tách biệt, ví dụ @('-p','kltn-thu','-f','D:\thu\docker-compose.yml'). Để trống = project
    trong thư mục repo (kltn).
#>
[CmdletBinding()]
param(
    [ValidateSet('all', 'steady', 'scale', 'failover')]
    [string]$Scenario = 'all',
    [ValidateRange(1, 2000)]
    [int]$Rate = 150,
    [ValidateRange(1, 60)]
    [int]$Minutes = 3,
    [ValidateRange(5, 600)]
    [int]$RampSec = 30,
    [ValidateRange(10, 900)]
    [int]$StepSec = 60,
    [int[]]$ScaleSteps = @(1, 2, 3, 4),
    [int]$MaxVus = 300,
    # Grafana chỉ nghe loopback (GRAFANA_PORT trong compose, mặc định 3001)
    [string]$GrafanaUrl = 'http://localhost:3001',
    [string]$K6Image = 'grafana/k6:1.8.2',
    [string]$HelperImage = 'alpine:3.20',
    # Trần CPU / RAM cho k6 — bộ sinh tải không được giành hết máy đang chạy production
    [string]$K6Cpus = '2',
    [string]$K6Memory = '1g',
    [int]$HealthyTimeoutSec = 300,
    # failover: quá chừng này (tính từ lúc kill) mà bản đó chưa healthy lại -> dựng bằng compose
    [int]$RecoverTimeoutSec = 120,
    [string[]]$ComposeOptions = @(),
    [string]$OutDir = '',
    [switch]$DryRun,
    [switch]$Yes
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

foreach ($n in $ScaleSteps) { if ($n -lt 1 -or $n -gt 10) { throw "-ScaleSteps: mỗi mức phải từ 1 tới 10 (nhận $n)" } }

$Root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$LoadDir = Join-Path $PSScriptRoot 'loadtest'
$Stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
if (-not $OutDir) { $OutDir = Join-Path $LoadDir ('results\grafana-' + $Stamp) }
$Dashboard = ($GrafanaUrl.TrimEnd('/')) + '/d/getshopy-lb'

$script:Timeline = New-Object System.Collections.ArrayList
$script:K6Start = $null
$script:K6Name = ''
$script:Changed = $false
$script:Network = '<network-của-compose>'

function Write-Title([string]$Text) { Write-Host ''; Write-Host "=== $Text ===" -ForegroundColor Cyan }
function Write-Cmd([string]$Text) { Write-Host "PS> $Text" -ForegroundColor DarkGray }
function Write-Note([string]$Text) { Write-Host $Text -ForegroundColor Gray }
function Write-Good([string]$Text) { Write-Host $Text -ForegroundColor Green }
function Write-Warn([string]$Text) { Write-Host "!! $Text" -ForegroundColor Yellow }

# Hàm THƯỜNG (không param/[Parameter]) và lấy đối số qua $args: hàm có [Parameter] là advanced
# function, PowerShell coi `-d` trong `compose up -d` là tham số chung -Debug của chính hàm (lỗi đã
# gặp ở lb-demo.ps1 ngày 18/11/2026). PowerShell 5.1 biến stderr của lệnh ngoài thành lỗi khi
# ErrorActionPreference = Stop -> hạ xuống Continue trong lúc gọi, kiểm $LASTEXITCODE.
function Invoke-Docker {
    $DockerArgs = [string[]]$args
    Write-Cmd ('docker ' + ($DockerArgs -join ' '))
    if ($DryRun) { return }
    $prev = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try {
        & docker @DockerArgs
        if ($LASTEXITCODE -ne 0) { throw "docker $($DockerArgs[0]) thoát mã $LASTEXITCODE" }
    } finally {
        $ErrorActionPreference = $prev
    }
}

# Chỉ ĐỌC (ps, inspect, wait): chạy cả khi -DryRun, không bao giờ ném lỗi.
function Get-DockerOut {
    $DockerArgs = [string[]]$args
    $prev = $ErrorActionPreference
    $ErrorActionPreference = 'SilentlyContinue'
    try {
        $out = & docker @DockerArgs 2>$null
        if ($LASTEXITCODE -ne 0) { return @() }
        return @($out | Where-Object { $_ -and $_.Trim() } | ForEach-Object { $_.Trim() })
    } catch {
        return @()
    } finally {
        $ErrorActionPreference = $prev
    }
}

function Invoke-Compose {
    $a = @('compose') + $ComposeOptions + [string[]]$args
    Invoke-Docker @a
}

function Get-ComposeOut {
    $a = @('compose') + $ComposeOptions + [string[]]$args
    Get-DockerOut @a
}

function Add-Event([string]$Text) {
    $now = Get-Date
    $rel = ''
    if ($script:K6Start) { $rel = [string][int]($now - $script:K6Start).TotalSeconds }
    if ($DryRun) { $Text = '(dry-run) ' + $Text }
    [void]$script:Timeline.Add([pscustomobject]@{ 'Giờ' = $now.ToString('HH:mm:ss'); 'T+ (s)' = $rel; 'Sự kiện' = $Text })
    Write-Good ("  [{0}] {1}" -f $now.ToString('HH:mm:ss'), $Text)
}

function Show-Look([string[]]$Lines) {
    Write-Host "  Grafana: $Dashboard" -ForegroundColor Magenta
    foreach ($l in $Lines) { Write-Host "  -> $l" -ForegroundColor Magenta }
}

# Thời điểm Docker ghi (RFC 3339, UTC, tới nano giây) -> DateTime giờ máy. .NET Framework chỉ
# đọc tối đa 7 chữ số lẻ của giây.
function ConvertFrom-DockerTime([string]$T) {
    if (-not $T -or $T.StartsWith('0001-')) { return $null }
    $t2 = $T -replace '(\.\d{7})\d+', '$1'
    try { return ([datetime]::Parse($t2, [Globalization.CultureInfo]::InvariantCulture, [Globalization.DateTimeStyles]::RoundtripKind)).ToLocalTime() }
    catch { return $null }
}

# Id 12 ký tự của các container server đang chạy = hostname = X-Served-By = nhãn hostname trên Grafana
function Get-ServerIds {
    return @(Get-ComposeOut ps -q server | ForEach-Object { $_.Substring(0, 12) } | Sort-Object)
}

function Wait-Healthy([int]$N) {
    if ($DryRun) { Write-Note "  (dry-run) chờ $N bản healthy"; return @() }
    $deadline = (Get-Date).AddSeconds($HealthyTimeoutSec)
    while ((Get-Date) -lt $deadline) {
        $ids = Get-ServerIds
        $states = @($ids | ForEach-Object { (Get-DockerOut inspect -f '{{.State.Health.Status}}' $_) -join '' })
        $healthy = @($states | Where-Object { $_ -eq 'healthy' }).Count
        if ($ids.Count -eq $N -and $healthy -eq $N) { return $ids }
        Write-Note ("  {0:HH:mm:ss}  {1}/{2} bản healthy ({3})" -f (Get-Date), $healthy, $N, ($states -join ', '))
        Start-Sleep -Seconds 3
    }
    throw "Quá $HealthyTimeoutSec s mà chưa đủ $N bản healthy — xem: docker compose logs server"
}

# --no-recreate: chỉ thêm / bớt container, KHÔNG tạo lại các bản đang chạy (kể cả khi
# docker-compose.yml đã đổi từ lần up trước). --no-deps: không đụng postgres/clickhouse/redis.
function Set-Replicas([int]$N, [string]$Why) {
    $script:Changed = $true
    Invoke-Compose up -d --no-deps --no-recreate --scale "server=$N" server
    Add-Event "lệnh scale -> $N bản ($Why)"
    $ids = Wait-Healthy $N
    if (-not $DryRun) { Add-Event "$N bản healthy: $($ids -join ', ')" }
}

function Start-K6([string]$Tag, [int]$HoldSec, [int]$MarkAt = 0) {
    $script:K6Name = "grafana-demo-k6-$Stamp-$Tag"
    $k6Args = @('run', '-d', '--name', $script:K6Name, '--network', $script:Network, '--cpus', $K6Cpus, '--memory', $K6Memory,
        '-v', "${LoadDir}:/scripts:ro", '-v', "${OutDir}:/out",
        '-e', 'BASE_URL=http://gateway', '-e', 'PROFILE=live', '-e', "RATE=$Rate", '-e', "RAMP=${RampSec}s",
        '-e', "DURATION=${HoldSec}s", '-e', "MAX_VUS=$MaxVus", '-e', "SUMMARY_PATH=/out/summary-$Tag.json")
    if ($MarkAt -gt 0) { $k6Args += @('-e', "MARK_AT=$MarkAt") }
    $k6Args += @($K6Image, 'run', '--quiet', '/scripts/k6-lb.js')
    Invoke-Docker @k6Args
    $script:K6Start = Get-Date
    Add-Event "k6 bắt đầu ($Tag): tăng dần 0 -> $Rate req/s trong $RampSec s, rồi giữ $HoldSec s"
}

function Test-K6Running {
    if ($DryRun) { return $true }
    return (((Get-DockerOut inspect -f '{{.State.Running}}' $script:K6Name) -join '') -eq 'true')
}

# Chờ tới mốc T+OffsetSec (tính từ lúc k6 bắt đầu). In đếm ngược thưa; k6 dừng sớm thì báo.
function Wait-Until([int]$OffsetSec, [string]$Next) {
    if ($DryRun) { Write-Note "  (dry-run) chờ tới T+$OffsetSec s rồi: $Next"; return }
    $target = $script:K6Start.AddSeconds($OffsetSec)
    $lastPrint = Get-Date
    while ((Get-Date) -lt $target) {
        if (((Get-Date) - $lastPrint).TotalSeconds -ge 15) {
            Write-Note ("  ... còn {0} s tới: {1}" -f [int]($target - (Get-Date)).TotalSeconds, $Next)
            $lastPrint = Get-Date
            if (-not (Test-K6Running)) { Write-Warn ('k6 đã dừng sớm — xem: docker logs ' + $script:K6Name); return }
        }
        Start-Sleep -Seconds 1
    }
}

function Get-Metric($Summary, [string]$Name, [string]$Key) {
    if (-not $Summary) { return $null }
    $p = $Summary.metrics.PSObject.Properties[$Name]
    if (-not $p) { return $null }
    $v = $p.Value.values.PSObject.Properties[$Key]
    if (-not $v) { return $null }
    return [double]$v.Value
}

# Chờ k6 xong, in kết quả, gỡ container. Trả về bản tóm tắt (đối tượng JSON) hoặc $null.
function Complete-K6([string]$Tag) {
    if ($DryRun) { Write-Cmd "docker wait $($script:K6Name)"; Write-Cmd "docker rm $($script:K6Name)"; return $null }
    Write-Note '  chờ k6 chạy xong...'
    $code = (Get-DockerOut wait $script:K6Name) -join ''
    Add-Event "k6 xong ($Tag), mã thoát $code"
    $file = Join-Path $OutDir "summary-$Tag.json"
    $null = Get-DockerOut rm $script:K6Name
    $script:K6Name = ''
    if (-not (Test-Path $file)) { Write-Warn "Không có $file — xem log k6 ở trên."; return $null }
    $s = Get-Content $file -Raw -Encoding UTF8 | ConvertFrom-Json
    $failed = Get-Metric $s 'failed_requests' 'count'
    if ($null -eq $failed) { $failed = 0 }
    [pscustomobject]@{
        'Kịch bản'          = $Tag
        'Request'           = [int](Get-Metric $s 'http_reqs{scenario:steady}' 'count')
        'p95 (ms)'          = [math]::Round((Get-Metric $s 'http_req_duration{scenario:steady}' 'p(95)'), 1)
        'p99 (ms)'          = [math]::Round((Get-Metric $s 'http_req_duration{scenario:steady}' 'p(99)'), 1)
        'Response khác 200' = [int]$failed
        'Bỏ lượt'           = [int](Get-Metric $s 'dropped_iterations{scenario:steady}' 'count')
    } | Format-Table -AutoSize | Out-Host
    return $s
}

# ─── Kịch bản ─────────────────────────────────────────────────────────────────

function Invoke-Steady {
    Write-Title "(1) steady — tăng dần rồi giữ $Rate req/s trong $Minutes phút"
    Show-Look @(
        'Hàng "Phân bố tải": "Request/s mỗi bản" — các đường của từng bản nằm sát nhau, đường Tổng ~ Rate',
        '"Tỷ trọng lưu lượng mỗi bản (%)" — mỗi dải ~ 100/N %; ô "Độ lệch tải giữa các bản" thấp',
        'Hàng "Độ trễ và lỗi": p95 / p99 các bản gần nhau; 5xx = 0')
    Start-K6 'steady' ($Minutes * 60)
    Wait-Until $RampSec "đạt $Rate req/s"
    Add-Event "đạt $Rate req/s — giữ $Minutes phút"
    $null = Complete-K6 'steady'
}

function Invoke-Scale {
    Write-Title "(2) scale — $($ScaleSteps -join ' -> ') bản, mỗi mức $StepSec s, tải $Rate req/s không đổi"
    Show-Look @(
        '"Bản server đang chạy" tăng từng bước; bảng "Danh sách bản server" thêm dòng',
        '"Request/s mỗi bản": mỗi lần scale có đường MỚI; các đường cũ hạ xuống ~ Rate/N',
        '"Tỷ trọng lưu lượng": dải mới xuất hiện, các dải chia lại; dấu cam "Số bản server thay đổi"',
        '"Độ trễ p95 mỗi bản" và "CPU mỗi bản": hạ xuống khi thêm bản (nếu Rate vượt sức 1 bản)')
    Set-Replicas $ScaleSteps[0] 'bắt đầu kịch bản scale'
    Start-K6 'scale' ($StepSec * $ScaleSteps.Count)
    for ($i = 1; $i -lt $ScaleSteps.Count; $i++) {
        $n = $ScaleSteps[$i]
        Wait-Until ($RampSec + $StepSec * $i) "scale lên $n bản"
        Set-Replicas $n "đang chịu $Rate req/s"
    }
    $null = Complete-K6 'scale'
}

function Invoke-Failover {
    Write-Title "(3) 1 server chết — kill -9 tiến trình chính của MỘT bản trong lúc chịu $Rate req/s"
    $ids = Get-ServerIds
    if (-not $DryRun -and $ids.Count -lt 2) {
        Set-Replicas 2 'cần >= 2 bản để các bản còn lại gánh tải'
        $ids = Get-ServerIds
    }
    $victim = '<id-bản-đầu-tiên>'
    if ($ids.Count -gt 0) { $victim = $ids[0] }

    # Chỉ ĐỌC biến DB_PREP trong môi trường container (không in các biến khác — có bí mật).
    $dbPrep = ''
    foreach ($line in (Get-DockerOut inspect -f '{{range .Config.Env}}{{println .}}{{end}}' $victim)) {
        if ($line -like 'DB_PREP=*') { $dbPrep = $line.Substring(8) }
    }
    $policy = (Get-DockerOut inspect -f '{{.HostConfig.RestartPolicy.Name}}' $victim) -join ''
    if (-not $policy) { $policy = '?' }
    Write-Note "Bản sẽ chết: $victim — restart policy: $policy, DB_PREP=$(if ($dbPrep) { $dbPrep } else { '(không đặt = auto)' })"
    if ($dbPrep -eq 'off') {
        Write-Note 'DB_PREP=off (như container CD tạo): Docker khởi động lại bản này KHÔNG chạy script DB nào (docker-entrypoint.sh) — chỉ chạy lại node.'
    } elseif (-not $DryRun) {
        Write-Warn "Container $victim KHÔNG có DB_PREP=off: khởi động lại sẽ chạy phần chuẩn bị DB của docker-entrypoint.sh"
        Write-Warn '(migrate deploy, ràng buộc tồn kho, ensure-inventory, seed-demo — dưới khoá khởi động). Container CD tạo luôn có DB_PREP=off.'
        $ans2 = Read-Host 'Vẫn giết bản này? (y/N)'
        if ($ans2 -notmatch '^(y|yes|c|co|có)$') { Write-Note 'Bỏ qua kịch bản 1 server chết.'; return }
    }
    if ($policy -notin @('always', 'unless-stopped', 'on-failure')) {
        Write-Warn "restart policy '$policy' không tự khởi động lại container — sau $RecoverTimeoutSec s script sẽ dựng lại bằng compose."
    }
    Show-Look @(
        "Bản sẽ chết: $victim",
        '"Request/s mỗi bản": đường của bản đó ĐỨT, các bản còn lại tăng lên gánh phần của nó',
        '"Bản server đang chạy" giảm 1 rồi tăng lại khi Docker tự khởi động lại bản đó (cùng tên)',
        '"Lỗi 5xx mỗi bản", "Request/s theo mã trạng thái": gateway thử lại bản khác khi lỗi kết nối')

    $markAt = $RampSec + $StepSec
    Start-K6 'failover' ($StepSec * 3) $markAt
    Wait-Until $markAt "kill -9 tiến trình chính của $victim"

    $pidText = (Get-DockerOut inspect -f '{{.State.Pid}}' $victim) -join ''
    $restartsBefore = 0
    [void][int]::TryParse(((Get-DockerOut inspect -f '{{.RestartCount}}' $victim) -join ''), [ref]$restartsBefore)
    $hostPid = 0
    if (-not [int]::TryParse($pidText, [ref]$hostPid) -or $hostPid -le 1) {
        if (-not $DryRun) { throw "Không đọc được PID của $victim (State.Pid='$pidText') — container không chạy?" }
        $hostPid = '<pid>'
    }
    # PID trong namespace của máy ảo Docker: chỉ container có --pid=host (đặc quyền) mới thấy.
    $script:Changed = $true
    Invoke-Docker run --rm --privileged --pid=host $HelperImage kill -9 $hostPid
    $killedAt = Get-Date
    Add-Event "kill -9 PID $hostPid (tiến trình chính của $victim) — giả lập crash, request dở dang trên bản này bị cắt"

    if ($DryRun) {
        Write-Note "  (dry-run) theo dõi docker inspect $victim (RestartCount, StartedAt, Health) tối đa $RecoverTimeoutSec s; quá hạn thì:"
        Invoke-Compose up -d --no-deps --no-recreate --scale "server=$([math]::Max(2, $ids.Count))" server
        $null = Complete-K6 'failover'
        return
    }

    $restartedAt = $null; $healthyAt = $null; $startedAt = $null; $finishedAt = $null; $restartsAfter = $restartsBefore
    $deadline = $killedAt.AddSeconds($RecoverTimeoutSec)
    while ((Get-Date) -lt $deadline) {
        $st = ((Get-DockerOut inspect -f '{{.State.Status}}|{{.RestartCount}}|{{.State.StartedAt}}|{{.State.FinishedAt}}|{{if .State.Health}}{{.State.Health.Status}}{{end}}' $victim) -join '') -split '\|'
        if ($st.Count -ge 5) {
            $rc = 0; [void][int]::TryParse($st[1], [ref]$rc)
            if (-not $restartedAt -and $st[0] -eq 'running' -and $rc -gt $restartsBefore) {
                $restartedAt = Get-Date; $restartsAfter = $rc
                $startedAt = ConvertFrom-DockerTime $st[2]; $finishedAt = ConvertFrom-DockerTime $st[3]
                Add-Event "Docker TỰ khởi động lại $victim (RestartCount $restartsBefore -> $rc, restart: $policy)"
            }
            if ($restartedAt -and $st[4] -eq 'healthy') {
                $healthyAt = Get-Date
                Add-Event "$victim healthy lại"
                break
            }
        }
        Start-Sleep -Milliseconds 500
    }
    if (-not $healthyAt) {
        $why = 'chưa healthy lại'
        if (-not $restartedAt) { $why = 'KHÔNG được Docker tự khởi động lại' }
        Add-Event "sau $RecoverTimeoutSec s $victim $why — dựng lại bằng compose (auto-restart KHÔNG thành công)"
        Invoke-Compose up -d --no-deps --no-recreate --scale "server=$($ids.Count)" server
        $null = Wait-Healthy $ids.Count
        Add-Event "đủ $($ids.Count) bản healthy (sau khi dựng tay)"
    }

    $s = Complete-K6 'failover'
    Write-Title "Kết quả — 1 server chết ($victim)"
    $fmt = 'HH:mm:ss.fff'
    Write-Note ("Kill lúc                  : {0}" -f $killedAt.ToString($fmt))
    if ($restartedAt) {
        Write-Note ("Docker khởi động lại      : thấy lúc {0} (sau {1:N1} s; script hỏi mỗi 0,5 s)" -f $restartedAt.ToString($fmt), ($restartedAt - $killedAt).TotalSeconds)
        if ($startedAt -and $finishedAt) {
            Write-Note ("  theo đồng hồ Docker      : thoát {0} -> chạy lại {1} = {2:N2} s (FinishedAt -> StartedAt)" -f $finishedAt.ToString($fmt), $startedAt.ToString($fmt), ($startedAt - $finishedAt).TotalSeconds)
        }
    } else {
        Write-Note 'Docker khởi động lại      : KHÔNG (xem restart policy ở trên)'
    }
    if ($healthyAt) {
        Write-Note ("Healthy lại lúc           : {0}" -f $healthyAt.ToString($fmt))
        Write-Note ("Bản này vắng mặt          : {0:N1} s (kill -> healthy, như 'downtime' một pod của Kubernetes)" -f ($healthyAt - $killedAt).TotalSeconds)
        Write-Note '  (healthy chỉ được đánh dấu ở lượt healthcheck kế tiếp — interval 10 s của compose — nên con số này gồm'
        Write-Note '   cả thời gian chờ lượt kiểm tra. Gateway không xét health của Docker: nó gửi lại cho bản này khi bản trả'
        Write-Note '   lời được VÀ hết thời gian tạm loại sau lỗi — max_fails=3 fail_timeout=10s trong gateway/nginx.conf.)'
    }
    if ($s) {
        $errBefore = Get-Metric $s 'failed_requests{phase:before}' 'count'
        $errAfter = Get-Metric $s 'failed_requests{phase:after}' 'count'
        if ($null -eq $errBefore) { $errBefore = 0 }
        if ($null -eq $errAfter) { $errAfter = 0 }
        Write-Note ("k6 response khác 200     : trước sự cố {0}, từ lúc kill tới hết lượt {1} (mốc lệch ~1 s: k6 khởi động sau lệnh docker)" -f [int]$errBefore, [int]$errAfter)
        Write-Note 'Gateway chỉ chuyển bản khi LỖI KẾT NỐI / timeout (proxy_next_upstream error timeout): GET đang dở trên bản'
        Write-Note 'chết được gửi lại bản khác, nên thường còn ít hoặc không lỗi. POST dở dang thì KHÔNG gửi lại (tránh đặt hàng hai lần).'
    }
}

# ─── Chuẩn bị ──────────────────────────────────────────────────────────────────
Push-Location $Root
$ans = ''
$before = 0
$prevDbPrep = $env:SERVER_DB_PREP
# Như deploy/cd/pull-deploy.ps1: bản server tạo thêm lúc scale chỉ chạy node, không đụng DB.
$env:SERVER_DB_PREP = 'off'
try {
    $gw = (Get-ComposeOut ps -q gateway | Select-Object -First 1)
    if (-not $gw -and -not $DryRun) { throw 'gateway chưa chạy (docker compose ps gateway). Demo đi qua gateway — bật stack trước.' }
    if ($gw) {
        $nets = (Get-DockerOut inspect -f '{{range $k, $v := .NetworkSettings.Networks}}{{$k}} {{end}}' $gw) -join ' '
        $script:Network = ($nets -split ' ' | Where-Object { $_ } | Select-Object -First 1)
    }
    $before = (Get-ServerIds).Count
    if ($before -lt 1 -and -not $DryRun) { throw 'Không có bản server nào đang chạy (docker compose ps server).' }

    $plan = @('steady', 'scale', 'failover')
    if ($Scenario -ne 'all') { $plan = @($Scenario) }
    $est = 0
    foreach ($p in $plan) {
        if ($p -eq 'steady') { $est += $RampSec + $Minutes * 60 }
        if ($p -eq 'scale') { $est += $RampSec + $StepSec * $ScaleSteps.Count }
        if ($p -eq 'failover') { $est += $RampSec + $StepSec * 3 }
    }

    Write-Title 'Demo trực tiếp trên Grafana — cân bằng tải'
    Write-Note "Thư mục compose : $Root"
    if ($ComposeOptions.Count -gt 0) { Write-Note "Tham số compose : $($ComposeOptions -join ' ')" }
    Write-Note "Network         : $($script:Network)"
    Write-Note "Bản server hiện : $before (sẽ trả về đúng số này khi xong)"
    Write-Note "Kịch bản        : $($plan -join ' -> '), tải $Rate req/s, ~$([math]::Ceiling($est / 60)) phút tải + thời gian scale"
    Write-Note "Kết quả k6      : $OutDir"
    Write-Host "Mở Grafana TRƯỚC khi chạy: $Dashboard   (đăng nhập admin; khung 15 phút, tự làm mới 5 s)" -ForegroundColor Magenta
    if (-not $DryRun) {
        try {
            $null = Invoke-WebRequest -Uri ($GrafanaUrl.TrimEnd('/') + '/api/health') -UseBasicParsing -TimeoutSec 5
        } catch {
            Write-Warn "Không gọi được Grafana ở $GrafanaUrl — bật bằng: docker compose up -d prometheus grafana"
        }
    }
    Write-Warn 'Tải chạy trên Postgres/Redis THẬT; lúc 1 bản thì một bản gánh cả khách thật. Chạy lúc vắng khách.'
    if ($DryRun) { Write-Warn 'DRY-RUN: chỉ in lệnh, không scale / kill / chạy k6.' }
    elseif (-not $Yes) {
        $ans = Read-Host 'Tiếp tục? (y/N)'
        if ($ans -notmatch '^(y|yes|c|co|có)$') { Write-Note 'Huỷ.'; return }
    }
    if (-not $DryRun) { New-Item -ItemType Directory -Force -Path $OutDir | Out-Null }

    foreach ($p in $plan) {
        if ($p -eq 'steady') { Invoke-Steady }
        if ($p -eq 'scale') { Invoke-Scale }
        if ($p -eq 'failover') { Invoke-Failover }
    }
} catch {
    Write-Warn $_.Exception.Message
    throw
} finally {
    # Chạy cả khi lỗi và khi Ctrl+C: gỡ k6 còn chạy, trả số bản server về như lúc bắt đầu.
    if ($script:K6Name -and -not $DryRun) {
        Write-Cmd "docker rm -f $($script:K6Name)"
        $null = Get-DockerOut rm -f $script:K6Name
        Add-Event 'đã gỡ container k6 đang chạy dở'
    }
    if ($script:Changed -and $before -gt 0) {
        Write-Title "Trả số bản server về $before"
        try {
            $script:K6Start = $null
            Invoke-Compose up -d --no-deps --no-recreate --scale "server=$before" server
            $null = Wait-Healthy $before
            Add-Event "đã trả về $before bản"
        } catch {
            Write-Warn "Không trả được số bản: $($_.Exception.Message). Chạy tay: docker compose up -d --no-deps server"
        }
    }
    if ($script:Timeline.Count -gt 0) {
        Write-Title 'Dòng thời gian — so với Grafana (T+ tính từ lúc k6 của kịch bản đó bắt đầu)'
        $script:Timeline | Format-Table -AutoSize | Out-Host
    }
    $env:SERVER_DB_PREP = $prevDbPrep
    Pop-Location
}
