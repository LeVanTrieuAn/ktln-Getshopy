<#
.SYNOPSIS
    Demo Kubernetes cho Getshopy (proof of concept): pod, cân bằng tải, tự phục hồi,
    tự co giãn (HPA), cập nhật cuốn chiếu (rolling update).

.DESCRIPTION
    Mỗi bước dừng chờ Enter để trình bày. Script CHỈ làm việc với context kubectl
    "docker-desktop" và namespace "getshopy-demo" (+ metrics-server ở kube-system); không chạy
    lệnh docker compose nào, không đụng container production.

      .\demo.ps1 -Step baseline   # TRƯỚC khi bật Kubernetes: lưu RAM gốc của máy ảo Docker
      .\demo.ps1                  # cả 7 bước: apply, pods, lb, heal, hpa, rolling, teardown
      .\demo.ps1 -Step lb         # chạy lại riêng một bước khi trình bày
      .\demo.ps1 -Step ram        # in RAM hiện tại

    Xem README.md cùng thư mục: chuẩn bị, giới hạn, cách gỡ.

.PARAMETER Image
    Image server. Mặc định kltn-server:k8s-demo (build từ nhánh feat/k8s-demo, có header
    X-Served-By). Dùng -Image kltn-server:latest để chạy bằng image production: vẫn chạy được,
    phân bố pod khi đó đếm từ log từng pod thay vì header.

.PARAMETER ProjectDir
    Thư mục repo có .env production — chuyển cho make-secret.ps1 (bắt buộc khi chạy từ worktree).

.PARAMETER LoadRps
    Số request/giây của bài tải thử ở bước hpa (k6). HPA không tăng pod thì nâng lên; máy ì thì hạ.
#>
[CmdletBinding()]
param(
    [ValidateSet('all', 'baseline', 'apply', 'pods', 'lb', 'heal', 'hpa', 'rolling', 'teardown', 'ram')]
    [string]$Step = 'all',
    [string]$Context = 'docker-desktop',
    [string]$Image = 'kltn-server:k8s-demo',
    [int]$Port = 30080,
    [ValidateRange(50, 5000)]
    [int]$LoadRps = 1000,
    # 15 s tăng + giữ + 10 s giảm <= 2 phút
    [ValidateRange(15, 90)]
    [int]$LoadHoldSeconds = 75,
    [string]$ProjectDir = '',
    [switch]$NoPause
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

$Ns = 'getshopy-demo'
$Here = $PSScriptRoot
$BaseUrl = "http://localhost:$Port"
$DefaultImage = 'kltn-server:k8s-demo'
$K6Image = 'grafana/k6:1.8.2'
$MemProbeImage = 'alpine/socat:1.8.0.3'
$BaselineFile = Join-Path $env:TEMP 'getshopy-k8s-demo-ram-baseline.json'
$Utf8 = New-Object System.Text.UTF8Encoding $false

# ─── Hiển thị ──────────────────────────────────────────────────────────────────

function Write-Title([string]$Text) {
    Write-Host ''
    Write-Host ('=' * 78) -ForegroundColor DarkCyan
    Write-Host "  $Text" -ForegroundColor Cyan
    Write-Host ('=' * 78) -ForegroundColor DarkCyan
}
function Write-Cmd([string]$Text) { Write-Host "PS> $Text" -ForegroundColor DarkGray }
function Write-Note([string]$Text) { Write-Host $Text -ForegroundColor Gray }
function Write-Good([string]$Text) { Write-Host $Text -ForegroundColor Green }
function Write-Warn([string]$Text) { Write-Host "!! $Text" -ForegroundColor Yellow }

function Wait-Enter([string]$Prompt = 'Nhấn Enter để sang bước tiếp theo') {
    if ($NoPause) { return }
    [void](Read-Host "`n>> $Prompt")
}

# ─── kubectl / docker ──────────────────────────────────────────────────────────

# In lệnh rồi chạy, luôn trên đúng context. ErrorActionPreference = Continue: cảnh báo kubectl
# ghi ra stderr không được làm dừng script (PowerShell 5.1 coi stderr là lỗi khi bị chuyển hướng);
# kết quả kiểm bằng $LASTEXITCODE ở nơi cần.
function kc {
    Write-Cmd ('kubectl ' + ($args -join ' '))
    $prev = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try {
        & kubectl --context $Context @args
    } finally {
        $ErrorActionPreference = $prev
    }
}

# Chạy im lặng, trả stdout (chuỗi) hoặc $null nếu lỗi. PowerShell 5.1 biến stderr của lệnh
# ngoài thành lỗi khi chuyển hướng, nên hạ ErrorActionPreference trong lúc gọi.
function Get-Kubectl {
    $prev = $ErrorActionPreference
    $ErrorActionPreference = 'SilentlyContinue'
    try {
        $out = & kubectl --context $Context @args 2>$null
        if ($LASTEXITCODE -ne 0) { return $null }
        return (($out | Out-String).Trim())
    } finally {
        $ErrorActionPreference = $prev
    }
}

function Test-DockerImage([string]$Name) {
    $prev = $ErrorActionPreference
    $ErrorActionPreference = 'SilentlyContinue'
    try {
        & docker image inspect $Name --format '{{.Id}}' 2>$null | Out-Null
        return ($LASTEXITCODE -eq 0)
    } finally {
        $ErrorActionPreference = $prev
    }
}

# Pipe một manifest (đã sửa trong bộ nhớ) vào kubectl apply.
function Invoke-ApplyText([string]$Yaml) {
    $prevEap = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    # Biến cục bộ của hàm: PowerShell mã hoá chuỗi pipe sang lệnh ngoài theo $OutputEncoding
    # (5.1 mặc định ASCII — chú thích tiếng Việt trong YAML sẽ thành '?').
    $OutputEncoding = $Utf8
    try {
        $Yaml | & kubectl --context $Context apply -f -
        $exit = $LASTEXITCODE
    } finally {
        $ErrorActionPreference = $prevEap
    }
    if ($exit -ne 0) { throw 'kubectl apply thất bại.' }
}

function Assert-Cluster {
    if (-not (Get-Command kubectl -ErrorAction SilentlyContinue)) {
        throw 'Không thấy kubectl. Docker Desktop cài sẵn ở C:\Program Files\Docker\Docker\resources\bin.'
    }
    $prev = $ErrorActionPreference
    $ErrorActionPreference = 'SilentlyContinue'
    $ctxs = & kubectl config get-contexts -o name 2>$null
    $ErrorActionPreference = $prev
    if (@($ctxs) -notcontains $Context) {
        throw "Chưa có context '$Context' — bật Kubernetes trong Docker Desktop trước (README, mục 3)."
    }
    $nodes = Get-Kubectl get nodes --no-headers
    if (-not $nodes -or $nodes -notmatch '\sReady\s') {
        throw "Node của cluster '$Context' chưa Ready:`n$nodes"
    }
}

function Get-ServerPods {
    $json = Get-Kubectl -n $Ns get pods -l app=server -o json
    if (-not $json) { return @() }
    $items = ($json | ConvertFrom-Json).items
    $list = @()
    foreach ($p in $items) {
        $ready = $false
        $reason = [string]$p.status.phase
        foreach ($c in @($p.status.containerStatuses)) {
            if ($null -eq $c) { continue }
            if ($c.ready) { $ready = $true }
            if ($c.state.waiting) { $reason = [string]$c.state.waiting.reason }
        }
        if ($p.metadata.deletionTimestamp) { $reason = 'Terminating'; $ready = $false }
        $list += [pscustomobject]@{ Name = $p.metadata.name; Ready = $ready; Reason = $reason; Ip = $p.status.podIP }
    }
    return $list
}

function Show-PodTrouble {
    kc -n $Ns get pods -o wide
    foreach ($p in (Get-ServerPods)) {
        if ($p.Reason -eq 'ErrImageNeverPull') {
            Write-Warn "Pod $($p.Name): ErrImageNeverPull — cluster không thấy image '$Image'."
            Write-Note '   Build image (README, mục 4) hoặc chạy -Image kltn-server:latest. Nếu đã có image mà vẫn lỗi:'
            Write-Note '   cluster đang dùng kiểu "kind" (node là container riêng, không chung image store) — dựng lại bằng kiểu Kubeadm.'
            return
        }
        if ($p.Reason -eq 'CrashLoopBackOff' -or $p.Reason -eq 'Error') {
            Write-Warn "Pod $($p.Name): $($p.Reason) — 30 dòng log cuối:"
            kc -n $Ns logs $p.Name --tail=30
            return
        }
    }
    Write-Note 'Xem thêm: kubectl -n getshopy-demo describe pod <tên-pod>  (mục Events cuối cùng)'
}

# ─── HTTP ──────────────────────────────────────────────────────────────────────

# -DisableKeepAlive: mỗi request một kết nối TCP mới. Service chia theo KẾT NỐI, giữ
# keep-alive thì cả loạt request dính một pod và không thấy được cân bằng tải.
function Invoke-Probe([string]$Path) {
    $sw = [Diagnostics.Stopwatch]::StartNew()
    try {
        $r = Invoke-WebRequest -Uri ($BaseUrl + $Path) -UseBasicParsing -DisableKeepAlive -TimeoutSec 5
        return [pscustomobject]@{ Ok = $true; Status = [int]$r.StatusCode; ServedBy = [string]$r.Headers['X-Served-By']; Ms = $sw.ElapsedMilliseconds; Error = '' }
    } catch {
        $code = 0
        $resp = $_.Exception.Response
        if ($resp) { try { $code = [int]$resp.StatusCode } catch { } }
        return [pscustomobject]@{ Ok = $false; Status = $code; ServedBy = ''; Ms = $sw.ElapsedMilliseconds; Error = $_.Exception.Message }
    }
}

# Vòng request chạy nền (tiến trình PowerShell riêng) trong lúc xoá pod / rolling update.
$LoopBlock = {
    param([string]$Url, [string]$StopFile, [int]$IntervalMs, [int]$MaxSeconds)
    $ProgressPreference = 'SilentlyContinue'
    $ok = 0
    $fail = 0
    $pods = @{}
    $order = New-Object System.Collections.ArrayList
    $errors = New-Object System.Collections.ArrayList
    $deadline = (Get-Date).AddSeconds($MaxSeconds)
    while (-not (Test-Path -LiteralPath $StopFile) -and (Get-Date) -lt $deadline) {
        $now = Get-Date
        try {
            $r = Invoke-WebRequest -Uri $Url -UseBasicParsing -DisableKeepAlive -TimeoutSec 5
            $ok++
            $name = [string]$r.Headers['X-Served-By']
            if (-not $name) { $name = '(không có X-Served-By)' }
            if (-not $pods.ContainsKey($name)) {
                $pods[$name] = @{ N = 0; First = $now; Last = $now }
                [void]$order.Add($name)
            }
            $pods[$name]['N'] = $pods[$name]['N'] + 1
            $pods[$name]['Last'] = $now
        } catch {
            $fail++
            $code = ''
            if ($_.Exception.Response) { try { $code = [int]$_.Exception.Response.StatusCode } catch { } }
            [void]$errors.Add(('{0:HH:mm:ss.fff}  HTTP {1}  {2}' -f $now, $code, $_.Exception.Message))
        }
        Start-Sleep -Milliseconds $IntervalMs
    }
    [pscustomobject]@{ Ok = $ok; Fail = $fail; Order = @($order); Pods = $pods; Errors = @($errors) }
}

function Start-RequestLoop([int]$MaxSeconds, [int]$IntervalMs) {
    $stop = Join-Path $env:TEMP ('getshopy-k8s-demo-stop-' + [guid]::NewGuid().ToString('N'))
    $job = Start-Job -ScriptBlock $LoopBlock -ArgumentList ($BaseUrl + '/api/health'), $stop, $IntervalMs, $MaxSeconds
    Write-Note ("Đã chạy nền vòng request GET {0}/api/health mỗi {1} ms (job {2})." -f $BaseUrl, $IntervalMs, $job.Id)
    # Tiến trình nền cần vài giây để khởi động trước khi gây sự cố.
    Start-Sleep -Seconds 4
    return [pscustomobject]@{ Job = $job; StopFile = $stop }
}

function Stop-RequestLoop($Handle) {
    New-Item -ItemType File -Path $Handle.StopFile -Force | Out-Null
    $result = Receive-Job -Job $Handle.Job -Wait -AutoRemoveJob
    Remove-Item -LiteralPath $Handle.StopFile -ErrorAction SilentlyContinue
    return $result
}

function Show-LoopResult($Result) {
    $total = $Result.Ok + $Result.Fail
    $color = 'Green'
    if ($Result.Fail -gt 0) { $color = 'Yellow' }
    Write-Host ''
    Write-Host ('Tổng {0} request: {1} thành công, {2} lỗi' -f $total, $Result.Ok, $Result.Fail) -ForegroundColor $color
    Write-Host ('  {0,-44} {1,8}   {2}' -f 'Pod trả lời (X-Served-By)', 'request', 'lần đầu -> lần cuối')
    foreach ($name in $Result.Order) {
        $p = $Result.Pods[$name]
        Write-Host ('  {0,-44} {1,8}   {2:HH:mm:ss} -> {3:HH:mm:ss}' -f $name, $p['N'], $p['First'], $p['Last'])
    }
    foreach ($e in @($Result.Errors | Select-Object -First 10)) { Write-Warn $e }
}

# ─── RAM ───────────────────────────────────────────────────────────────────────

# RAM cả máy ảo Docker Desktop: đọc /proc/meminfo từ một container tạm (Docker Desktop không
# ảo hoá /proc/meminfo, nên container thấy số của máy ảo). Dùng image có sẵn trên máy.
function Get-VmMemory {
    $prev = $ErrorActionPreference
    $ErrorActionPreference = 'SilentlyContinue'
    try {
        $lines = & docker run --rm --network none --entrypoint cat $MemProbeImage /proc/meminfo 2>$null
        if ($LASTEXITCODE -ne 0 -or -not $lines) { return $null }
    } finally {
        $ErrorActionPreference = $prev
    }
    $kv = @{}
    foreach ($l in $lines) { if ($l -match '^(\w+):\s+(\d+)\s*kB') { $kv[$Matches[1]] = [int64]$Matches[2] } }
    if (-not $kv.ContainsKey('MemTotal') -or -not $kv.ContainsKey('MemAvailable')) { return $null }
    $total = [int][math]::Round($kv['MemTotal'] / 1024)
    $avail = [int][math]::Round($kv['MemAvailable'] / 1024)
    return [pscustomobject]@{ TotalMiB = $total; UsedMiB = $total - $avail; AvailableMiB = $avail; At = (Get-Date).ToString('yyyy-MM-dd HH:mm') }
}

function ConvertTo-MiB([string]$Text) {
    if ($Text -match '^([\d.]+)\s*(B|KiB|MiB|GiB|Ki|Mi|Gi|kB|MB|GB)$') {
        $v = [double]$Matches[1]
        switch -Regex ($Matches[2]) {
            '^(KiB|Ki|kB)$' { return $v / 1024 }
            '^(MiB|Mi|MB)$' { return $v }
            '^(GiB|Gi|GB)$' { return $v * 1024 }
            default { return $v / 1MB }
        }
    }
    return 0
}

function Show-Ram([string]$Label) {
    Write-Host ''
    Write-Host "RAM [$Label]" -ForegroundColor Cyan
    $m = Get-VmMemory
    if ($m) {
        Write-Host ('  Máy ảo Docker: dùng {0:N0} / {1:N0} MiB (còn {2:N0} MiB)' -f $m.UsedMiB, $m.TotalMiB, $m.AvailableMiB)
        if (Test-Path -LiteralPath $BaselineFile) {
            $b = Get-Content -LiteralPath $BaselineFile -Raw | ConvertFrom-Json
            Write-Host ('  So với lúc chưa bật Kubernetes ({0}, dùng {1:N0} MiB): {2:+#,0;-#,0;0} MiB' -f $b.At, $b.UsedMiB, ($m.UsedMiB - $b.UsedMiB))
        } else {
            Write-Note '  (Chưa có số gốc: chạy .\demo.ps1 -Step baseline TRƯỚC khi bật Kubernetes.)'
        }
    } else {
        Write-Warn "Không đọc được /proc/meminfo của máy ảo (cần image $MemProbeImage)."
    }

    # Container hệ thống của Kubernetes — chỉ thấy bằng docker khi bật "Show system containers".
    $prev = $ErrorActionPreference
    $ErrorActionPreference = 'SilentlyContinue'
    $names = @(& docker ps --filter 'name=k8s_' --format '{{.Names}}' 2>$null)
    $stats = @()
    if ($names.Count -gt 0) { $stats = @(& docker stats --no-stream --format '{{.Name}}|{{.MemUsage}}' @names 2>$null) }
    $ErrorActionPreference = $prev
    if ($stats.Count -gt 0) {
        $sum = 0.0
        foreach ($s in $stats) { $sum += ConvertTo-MiB (($s -split '\|')[1] -split ' / ')[0].Trim() }
        Write-Host ('  docker stats, {0} container k8s_*: {1:N0} MiB' -f $names.Count, $sum)
    }

    # Theo namespace, từ metrics-server (working set của container, chưa gồm kubelet/runtime).
    $top = Get-Kubectl top pods -A --no-headers
    if ($top) {
        $byNs = @{}
        foreach ($line in ($top -split "`r?`n")) {
            $cols = $line -split '\s+'
            if ($cols.Count -ge 4) { $byNs[$cols[0]] = [double]$byNs[$cols[0]] + (ConvertTo-MiB $cols[3]) }
        }
        foreach ($k in ($byNs.Keys | Sort-Object)) { Write-Host ('  kubectl top, namespace {0,-16} {1,6:N0} MiB' -f $k, $byNs[$k]) }
    }
}

# ─── Các bước ──────────────────────────────────────────────────────────────────

function Step-Baseline {
    Write-Title 'Số RAM gốc (chạy TRƯỚC khi bật Kubernetes)'
    $m = Get-VmMemory
    if (-not $m) { throw "Không đo được RAM máy ảo (cần Docker đang chạy và image $MemProbeImage)." }
    $m | ConvertTo-Json | Set-Content -LiteralPath $BaselineFile -Encoding ASCII
    Write-Good ('Máy ảo Docker: dùng {0:N0} / {1:N0} MiB — đã lưu {2}' -f $m.UsedMiB, $m.TotalMiB, $BaselineFile)
}

function Step-Apply {
    Write-Title 'BƯỚC 1/7 — Triển khai tầng ứng dụng lên Kubernetes'
    Assert-Cluster
    if (-not (Test-DockerImage $Image)) {
        Write-Warn "Chưa có image '$Image'. Build từ nhánh feat/k8s-demo (README, mục 4):"
        Write-Note '   docker build -t kltn-server:k8s-demo ktln-Getshopy/qu-n-ly-ban-l/source/server'
        Write-Note '   hoặc chạy bằng image production:  .\demo.ps1 -Image kltn-server:latest'
        throw 'Thiếu image server.'
    }
    Show-Ram 'trước khi apply'

    kc apply -f (Join-Path $Here 'manifests\00-namespace.yaml')
    Write-Cmd '.\make-secret.ps1   (Secret server-env từ .env production, không in giá trị)'
    $secretArgs = @{ Context = $Context; Namespace = $Ns }
    if ($ProjectDir) { $secretArgs['ProjectDir'] = $ProjectDir }
    & (Join-Path $Here 'make-secret.ps1') @secretArgs

    kc apply -k (Join-Path $Here 'metrics-server')
    kc apply -f (Join-Path $Here 'manifests\10-configmap.yaml')
    $deploy = Get-Content -LiteralPath (Join-Path $Here 'manifests\20-deployment.yaml') -Raw -Encoding UTF8
    if ($Image -ne $DefaultImage) { $deploy = $deploy.Replace("image: $DefaultImage", "image: $Image") }
    Write-Cmd "kubectl apply -f manifests\20-deployment.yaml   (image: $Image)"
    Invoke-ApplyText $deploy
    kc apply -f (Join-Path $Here 'manifests\30-service.yaml')
    kc apply -f (Join-Path $Here 'manifests\40-hpa.yaml')

    Write-Host ''
    kc -n $Ns rollout status deployment/server --timeout=180s
    if ($LASTEXITCODE -ne 0) {
        Show-PodTrouble
        throw 'Deployment server chưa sẵn sàng sau 180 s.'
    }

    Write-Note "Chờ Docker Desktop mở Service LoadBalancer ở $BaseUrl ..."
    $deadline = (Get-Date).AddSeconds(90)
    $probe = $null
    do {
        $probe = Invoke-Probe '/api/health'
        if ($probe.Ok) { break }
        Start-Sleep -Seconds 3
    } while ((Get-Date) -lt $deadline)
    if (-not $probe.Ok) {
        kc -n $Ns get service server
        throw "Không gọi được $BaseUrl/api/health: $($probe.Error)"
    }
    Write-Good ("$BaseUrl/api/health -> HTTP {0}, trả lời bởi pod: {1}" -f $probe.Status, $probe.ServedBy)
    if (-not $probe.ServedBy) { Write-Note '(Image không có header X-Served-By — bước lb sẽ đếm theo log từng pod.)' }
    Show-PortBinding

    Write-Host ''
    kc -n kube-system rollout status deployment/metrics-server --timeout=180s
    if ($LASTEXITCODE -ne 0) { Write-Warn 'metrics-server chưa sẵn sàng — HPA sẽ báo <unknown> cho tới khi có số CPU.' }
    Show-Ram 'sau khi apply'
}

function Show-PortBinding {
    $addrs = @()
    try {
        $addrs = @(Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction Stop | Select-Object -ExpandProperty LocalAddress -Unique)
    } catch { }
    if ($addrs.Count -eq 0) {
        Write-Note "Không thấy tiến trình Windows nào nghe cổng $Port (kiểm tay: netstat -ano | findstr :$Port)."
        return
    }
    Write-Host ('Cổng {0} đang nghe trên: {1}' -f $Port, ($addrs -join ', '))
    if (@($addrs | Where-Object { $_ -eq '0.0.0.0' -or $_ -eq '::' }).Count -gt 0) {
        Write-Warn "Cổng $Port mở trên MỌI địa chỉ của máy: máy khác cùng mạng gọi thẳng được API demo (không qua gateway)."
        Write-Warn 'Chỉ demo trên mạng tin cậy, và dọn (bước 7) ngay sau buổi demo.'
    }
}

function Step-Pods {
    Write-Title 'BƯỚC 2/7 — Pod, Deployment, Service, HPA'
    kc -n $Ns get pods -o wide
    Write-Host ''
    kc -n $Ns get deployment,replicaset,service,hpa
    Write-Host ''
    kc -n $Ns get endpointslices -l kubernetes.io/service-name=server
    Write-Note ''
    Write-Note 'Deployment giữ số pod mong muốn qua ReplicaSet; Service gom các pod Ready (EndpointSlice ở trên)'
    Write-Note "sau một địa chỉ duy nhất; Docker Desktop đưa Service LoadBalancer ra $BaseUrl."
}

function Step-Lb {
    Write-Title "BƯỚC 3/7 — Cân bằng tải: 20 request vào $BaseUrl/api/health"
    $run = (Get-Date).ToString('HHmmss')
    $results = @()
    for ($i = 1; $i -le 20; $i++) {
        $p = Invoke-Probe "/api/health?demo=$run-$i"
        $who = $p.ServedBy
        if (-not $p.Ok) { $who = "LỖI: $($p.Error)" }
        Write-Host ('  #{0,2}  HTTP {1}  {2,4} ms  {3}' -f $i, $p.Status, $p.Ms, $who)
        $results += $p
    }

    $counts = [ordered]@{}
    if (@($results | Where-Object { $_.ServedBy }).Count -gt 0) {
        foreach ($g in ($results | Where-Object { $_.Ok } | Group-Object ServedBy | Sort-Object Name)) { $counts[$g.Name] = $g.Count }
        $source = 'header X-Served-By'
    } else {
        # Image không có header: mỗi pod tự ghi log từng request (morgan) — đếm dòng mang mã lượt chạy.
        foreach ($p in (Get-ServerPods)) {
            $log = Get-Kubectl -n $Ns logs $p.Name --since=10m
            $n = 0
            if ($log) { $n = @($log -split "`r?`n" | Where-Object { $_ -match "demo=$run-" }).Count }
            $counts[$p.Name] = $n
        }
        $source = 'log của từng pod'
    }
    Write-Host ''
    Write-Host "Phân bố theo pod (nguồn: $source):" -ForegroundColor Cyan
    foreach ($k in $counts.Keys) { Write-Host ('  {0,-40} {1,3}  {2}' -f $k, $counts[$k], ('#' * $counts[$k])) }
    $fails = @($results | Where-Object { -not $_.Ok }).Count
    Write-Note ''
    Write-Note "Lỗi: $fails / 20. kube-proxy chọn pod NGẪU NHIÊN cho mỗi kết nối, nên 20 lần không nhất thiết chia đều 10/10;"
    Write-Note 'chạy lại vài lần (.\demo.ps1 -Step lb) sẽ thấy tỉ lệ dao động quanh 50/50.'
}

function Step-Heal {
    Write-Title 'BƯỚC 4/7 — Tự phục hồi: xoá một pod đang phục vụ'
    kc -n $Ns get pods -o wide
    $victim = @(Get-ServerPods | Where-Object { $_.Ready } | Select-Object -First 1)
    if ($victim.Count -eq 0) { throw 'Không có pod server nào Ready.' }
    $victimName = $victim[0].Name

    $loop = Start-RequestLoop -MaxSeconds 120 -IntervalMs 200
    Write-Host ''
    Write-Host ('{0:HH:mm:ss}  Xoá pod {1}' -f (Get-Date), $victimName) -ForegroundColor Magenta
    kc -n $Ns delete pod $victimName --wait=false

    # Theo dõi tới khi lại đủ 2 pod Ready (không tính pod vừa xoá), tối đa 90 s.
    $deadline = (Get-Date).AddSeconds(90)
    do {
        Start-Sleep -Seconds 2
        $pods = Get-ServerPods
        $line = ($pods | ForEach-Object {
            $state = $_.Reason
            if ($_.Ready) { $state = 'Ready' }
            '{0}={1}' -f ($_.Name -replace '^server-', ''), $state
        }) -join '  '
        Write-Host ('{0:HH:mm:ss}  {1}' -f (Get-Date), $line)
        $readyOthers = @($pods | Where-Object { $_.Ready -and $_.Name -ne $victimName }).Count
    } while ($readyOthers -lt 2 -and (Get-Date) -lt $deadline)

    Start-Sleep -Seconds 3
    $result = Stop-RequestLoop $loop
    Show-LoopResult $result
    Write-Host ''
    kc -n $Ns get pods -o wide
    Write-Note ''
    Write-Note 'ReplicaSet thấy thiếu pod so với số mong muốn và tạo pod mới ngay; Service ngừng gửi kết nối'
    Write-Note 'tới pod đang xoá, nên request vẫn được pod còn lại trả lời trong lúc pod mới khởi động.'
}

function Get-HpaStatus {
    $json = Get-Kubectl -n $Ns get hpa server -o json
    if (-not $json) { return $null }
    $h = $json | ConvertFrom-Json
    $cpu = '?'
    foreach ($m in @($h.status.currentMetrics)) {
        if ($m -and $m.resource -and $m.resource.name -eq 'cpu' -and $null -ne $m.resource.current.averageUtilization) {
            $cpu = [string]$m.resource.current.averageUtilization + '%'
        }
    }
    return [pscustomobject]@{ Current = [int]$h.status.currentReplicas; Desired = [int]$h.status.desiredReplicas; Cpu = $cpu }
}

function Write-HpaLine([string]$Extra) {
    $h = Get-HpaStatus
    $dep = Get-Kubectl -n $Ns get deployment server -o 'jsonpath={.status.readyReplicas}/{.status.replicas}'
    if ($h) {
        Write-Host ('{0:HH:mm:ss}   CPU TB {1,5} (mục tiêu 60%)   pod hiện tại {2} -> mong muốn {3}   Ready {4,-5}  {5}' -f (Get-Date), $h.Cpu, $h.Current, $h.Desired, $dep, $Extra)
    }
    return $h
}

function Step-Hpa {
    Write-Title 'BƯỚC 5/7 — Tự co giãn (HPA) dưới tải'
    Write-Note 'Chờ metrics-server có số CPU của pod...'
    $deadline = (Get-Date).AddSeconds(120)
    while (-not (Get-Kubectl -n $Ns top pods --no-headers) -and (Get-Date) -lt $deadline) { Start-Sleep -Seconds 5 }
    kc -n $Ns top pods
    kc -n $Ns get hpa server
    if (-not (Test-DockerImage $K6Image)) {
        Write-Warn "Chưa có image $K6Image trên máy — kubelet sẽ tự kéo (~37 MB, cần mạng). Kéo trước: docker pull $K6Image"
    }
    $total = 15 + $LoadHoldSeconds + 10
    Write-Note ''
    Write-Note ("Tải thử: k6 trong cluster, GET /api/b2c/categories (chỉ đọc, cache trong pod), {0} request/giây, ~{1} s." -f $LoadRps, $total)
    Write-Note 'Đọc DB production gần như bằng 0 (mỗi pod ~1 truy vấn / 5 phút), nhưng vẫn nên chạy ngoài giờ cao điểm.'
    Wait-Enter 'Nhấn Enter để bắt đầu bắn tải'

    [void](Get-Kubectl -n $Ns delete job k6-load --ignore-not-found --wait=true)
    $yaml = Get-Content -LiteralPath (Join-Path $Here 'loadtest\k6-job.yaml') -Raw -Encoding UTF8
    $yaml = [regex]::Replace($yaml, '\{name: RATE, value: "\d+"\}', ('{name: RATE, value: "' + $LoadRps + '"}'))
    $yaml = [regex]::Replace($yaml, '\{name: HOLD, value: "\d+s"\}', ('{name: HOLD, value: "' + $LoadHoldSeconds + 's"}'))
    Write-Cmd ("kubectl apply -f loadtest\k6-job.yaml   (RATE={0}, HOLD={1}s)" -f $LoadRps, $LoadHoldSeconds)
    Invoke-ApplyText $yaml

    Write-Host ''
    $deadline = (Get-Date).AddSeconds($total + 150)
    do {
        Start-Sleep -Seconds 5
        $job = Get-Kubectl -n $Ns get job k6-load -o 'jsonpath={.status.succeeded}/{.status.failed}/{.status.active}'
        $parts = ([string]$job) -split '/'
        $state = 'k6: chờ khởi động'
        if ($parts.Count -ge 3 -and $parts[2]) { $state = 'k6: đang bắn' }
        $done = ($parts.Count -ge 2 -and ($parts[0] -or $parts[1]))
        if ($done) { $state = 'k6: xong' }
        [void](Write-HpaLine $state)
    } while (-not $done -and (Get-Date) -lt $deadline)

    Write-Host ''
    Write-Host 'Kết quả k6 (http_reqs = số request, http_req_failed = tỉ lệ lỗi, http_req_duration = độ trễ):' -ForegroundColor Cyan
    kc -n $Ns logs job/k6-load --tail=45
    Write-Host ''
    kc -n $Ns get pods -o wide
    Write-Host ''
    Write-Cmd "kubectl -n $Ns describe hpa server   (phần Events)"
    $desc = Get-Kubectl -n $Ns describe hpa server
    if ($desc) {
        $idx = $desc.IndexOf('Events:')
        if ($idx -ge 0) { Write-Host $desc.Substring($idx) }
    }

    Wait-Enter 'Nhấn Enter để xem HPA thu về 2 pod khi hết tải (~2-3 phút; Ctrl+C để bỏ qua)'
    $deadline = (Get-Date).AddSeconds(240)
    do {
        Start-Sleep -Seconds 10
        $h = Write-HpaLine ''
    } while ($h -and $h.Current -gt 2 -and (Get-Date) -lt $deadline)
}

function Step-Rolling {
    Write-Title 'BƯỚC 6/7 — Cập nhật cuốn chiếu (rolling update) trong lúc vẫn có request'
    kc -n $Ns get pods -o wide
    Write-Note ''
    Write-Note 'maxSurge=1, maxUnavailable=0: thêm 1 pod mới, đợi readinessProbe đạt, rồi mới bỏ 1 pod cũ.'
    Write-Note '"rollout restart" tạo ReplicaSet mới y như khi đổi image phiên bản mới.'

    $loop = Start-RequestLoop -MaxSeconds 360 -IntervalMs 100
    Write-Host ''
    Write-Host ('{0:HH:mm:ss}  Bắt đầu rolling update' -f (Get-Date)) -ForegroundColor Magenta
    kc -n $Ns rollout restart deployment/server
    kc -n $Ns rollout status deployment/server --timeout=300s
    Write-Host ('{0:HH:mm:ss}  Rolling update xong' -f (Get-Date)) -ForegroundColor Magenta
    Start-Sleep -Seconds 5
    $result = Stop-RequestLoop $loop
    Show-LoopResult $result
    Write-Host ''
    kc -n $Ns get pods -o wide
    kc -n $Ns rollout history deployment/server
}

function Step-Teardown {
    Write-Title 'BƯỚC 7/7 — Dọn dẹp'
    Show-Ram 'trước khi dọn'
    kc delete namespace $Ns --wait=true --timeout=180s
    kc delete -k (Join-Path $Here 'metrics-server') --ignore-not-found
    Show-Ram 'sau khi dọn — Kubernetes vẫn đang bật'
    Write-Host ''
    Write-Host 'Trả lại RAM cho production: tắt hẳn Kubernetes.' -ForegroundColor Cyan
    Write-Note '  Docker Desktop -> Kubernetes -> Stop (bản cũ: Settings -> Kubernetes -> bỏ "Enable Kubernetes" -> Apply).'
    Write-Note '  Sau đó: .\demo.ps1 -Step ram   để so với số gốc.'
}

# ─── Chạy ──────────────────────────────────────────────────────────────────────

$prevConsoleEncoding = [Console]::OutputEncoding
try {
    try { [Console]::OutputEncoding = $Utf8 } catch { }
    switch ($Step) {
        'baseline' { Step-Baseline }
        'ram'      { Show-Ram 'hiện tại' }
        'apply'    { Step-Apply }
        'teardown' { Assert-Cluster; Step-Teardown }
        'pods'     { Assert-Cluster; Step-Pods }
        'lb'       { Assert-Cluster; Step-Lb }
        'heal'     { Assert-Cluster; Step-Heal }
        'hpa'      { Assert-Cluster; Step-Hpa }
        'rolling'  { Assert-Cluster; Step-Rolling }
        'all' {
            Step-Apply
            Wait-Enter
            Step-Pods
            Wait-Enter
            Step-Lb
            Wait-Enter
            Step-Heal
            Wait-Enter
            Step-Hpa
            Wait-Enter
            Step-Rolling
            Wait-Enter 'Nhấn Enter để DỌN DẸP (xoá namespace getshopy-demo + metrics-server)'
            Step-Teardown
        }
    }
} finally {
    try { [Console]::OutputEncoding = $prevConsoleEncoding } catch { }
}
