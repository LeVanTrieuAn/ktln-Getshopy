<#
.SYNOPSIS
    Demo Kubernetes cho Getshopy (proof of concept): pod, cân bằng tải, tự phục hồi, tự co giãn
    (HPA) và PHÁT HÀNH KHÔNG GIÁN ĐOẠN — nâng cấp cuốn chiếu v1 -> v2, bản lỗi bị chặn rồi
    rollout undo, blue-green có kiểm thử trước khi chuyển khách.

.DESCRIPTION
    Mỗi bước dừng chờ Enter để trình bày. Script CHỈ làm việc với context kubectl
    "docker-desktop", namespace "getshopy-demo" và "getshopy-bg" (+ metrics-server ở kube-system);
    không chạy lệnh docker compose nào, không đụng container production, không build image.

      .\demo.ps1 -Step baseline     # TRƯỚC khi bật Kubernetes: lưu RAM gốc của máy ảo Docker
      .\demo.ps1                    # cả 10 bước: images, apply, pods, lb, heal, hpa, rolling,
                                    #             badrelease, bluegreen, teardown
      .\demo.ps1 -Step rolling      # chạy lại riêng một bước khi trình bày
      .\demo.ps1 -Step ram          # in RAM hiện tại

    Xem README.md cùng thư mục: chuẩn bị, trình tự trình bày, các núm thời gian, giới hạn.

.PARAMETER ImageV1
    Image "v1" (mặc định kltn-server:k8s-v1): bước apply triển khai bản này, blue chạy bản này.
    Bí danh cũ: -Image.

.PARAMETER ImageV2
    Image "v2" (mặc định kltn-server:k8s-v2): bước rolling nâng cấp lên bản này, green chạy bản này.

.PARAMETER SourceImage
    Image gốc mà bước images gắn tag v1 / v2 (mặc định kltn-server:latest — image production).
    v1 và v2 vì vậy là CÙNG một image: demo minh hoạ cơ chế phát hành, không phải khác biệt code.

.PARAMETER BadRelease
    Kiểu bản lỗi ở bước badrelease:
      readiness (mặc định)  bản đang chạy + biến PORT=8081: tiến trình chạy nhưng không nghe ở cổng
                            8080 đã khai báo, readinessProbe không bao giờ đạt ("chạy được nhưng hỏng").
      image                 tag không tồn tại: pod kẹt ở ErrImageNeverPull, container không chạy.

.PARAMETER BgReplicas
    Số pod mỗi màu ở bước bluegreen (1–2, mặc định 2). Máy ảo chật RAM thì dùng 1.

.PARAMETER ProjectDir
    Thư mục repo có .env production — chuyển cho make-secret.ps1 (bắt buộc khi chạy từ worktree).

.PARAMETER LoadRps
    Số request/giây của bài tải thử ở bước hpa (k6). HPA không tăng pod thì nâng lên; máy ì thì hạ.
#>
[CmdletBinding()]
param(
    [ValidateSet('all', 'baseline', 'images', 'apply', 'pods', 'lb', 'heal', 'hpa', 'rolling', 'badrelease', 'bluegreen', 'teardown', 'ram')]
    [string]$Step = 'all',
    [string]$Context = 'docker-desktop',
    [Alias('Image')]
    [string]$ImageV1 = 'kltn-server:k8s-v1',
    [string]$ImageV2 = 'kltn-server:k8s-v2',
    [string]$SourceImage = 'kltn-server:latest',
    [int]$Port = 30080,
    [ValidateRange(50, 5000)]
    [int]$LoadRps = 1000,
    # 15 s tăng + giữ + 10 s giảm <= 2 phút
    [ValidateRange(15, 90)]
    [int]$LoadHoldSeconds = 75,
    [ValidateSet('readiness', 'image')]
    [string]$BadRelease = 'readiness',
    [ValidateRange(1, 2)]
    [int]$BgReplicas = 2,
    [string]$ProjectDir = '',
    [switch]$NoPause
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

$Ns = 'getshopy-demo'
$BgNs = 'getshopy-bg'
$Here = $PSScriptRoot
$BaseUrl = "http://localhost:$Port"
# Cổng của bước blue-green — khớp bluegreen\30-services.yaml.
$BgPort = 30090
$PreviewPort = 30091
$BgUrl = "http://localhost:$BgPort"
$PreviewUrl = "http://localhost:$PreviewPort"
# Tag ghi trong manifest; -ImageV1 / -ImageV2 khác thì script thay chuỗi trước khi apply.
$DefaultV1 = 'kltn-server:k8s-v1'
$DefaultV2 = 'kltn-server:k8s-v2'
$BrokenImage = 'kltn-server:k8s-v3-khong-ton-tai'
$BadPort = '8081'
# Pool Prisma mỗi pod (connection_limit trong DATABASE_URL của Secret) — make-secret.ps1.
$PgPoolPerPod = 5
# Vòng request khi phát hành gọi một endpoint NGHIỆP VỤ chỉ đọc (danh sách danh mục, cache trong
# bộ nhớ pod 300 s), KHÔNG gọi /api/health: pod đang tắt êm cố ý trả 503 ở /api/health để thôi
# nhận khách, còn request nghiệp vụ thì nó vẫn phục vụ trong 5 s drain — đó mới là thứ khách thấy.
$LoopPath = '/api/b2c/categories'
$TotalSteps = 10
$K6Image = 'grafana/k6:1.8.2'
$MemProbeImage = 'alpine/socat:1.8.0.3'
$BaselineFile = Join-Path $env:TEMP 'getshopy-k8s-demo-ram-baseline.json'
$Utf8 = New-Object System.Text.UTF8Encoding $false
# Job nền của các vòng request — finally ở cuối file dọn nếu bước bị Ctrl+C giữa chừng.
$LoopJobs = New-Object System.Collections.ArrayList

# ─── Hiển thị ──────────────────────────────────────────────────────────────────

function Write-Title([string]$Text) {
    Write-Host ''
    Write-Host ('=' * 78) -ForegroundColor DarkCyan
    Write-Host "  $Text" -ForegroundColor Cyan
    Write-Host ('=' * 78) -ForegroundColor DarkCyan
}
function Write-StepTitle([int]$N, [string]$Text) { Write-Title ('BƯỚC {0}/{1} — {2}' -f $N, $TotalSteps, $Text) }
function Write-Cmd([string]$Text) { Write-Host "PS> $Text" -ForegroundColor DarkGray }
function Write-Note([string]$Text) { Write-Host $Text -ForegroundColor Gray }
function Write-Good([string]$Text) { Write-Host $Text -ForegroundColor Green }
function Write-Warn([string]$Text) { Write-Host "!! $Text" -ForegroundColor Yellow }
function Write-Event([string]$Text) { Write-Host ('{0:HH:mm:ss}  {1}' -f (Get-Date), $Text) -ForegroundColor Magenta }

function Wait-Enter([string]$Prompt = 'Nhấn Enter để sang bước tiếp theo') {
    if ($NoPause) { return }
    [void](Read-Host "`n>> $Prompt")
}

# Lệnh in ra phải dán lại được vào PowerShell: tham số có khoảng trắng, dấu phẩy (PowerShell hiểu
# a,b là mảng), ngoặc nhọn... thì bọc nháy đơn.
function Format-Args($List) {
    $parts = foreach ($a in @($List)) {
        $s = [string]$a
        if ($s -match "[\s,;(){}@`$&|<>'``]") { "'" + $s.Replace("'", "''") + "'" } else { $s }
    }
    return (@($parts) -join ' ')
}

# ─── kubectl / docker ──────────────────────────────────────────────────────────

# `kc get deployment,replicaset`: PowerShell đọc deployment,replicaset là MẢNG, và khi chuyển tiếp
# qua @args sang lệnh ngoài thì mảng bị tách thành nhiều tham số — kubectl nhận
# "get deployment replicaset" (= Deployment TÊN "replicaset") và báo NotFound. Ghép lại bằng dấu
# phẩy đúng như người gõ. (Gọi thẳng kubectl không qua hàm thì PowerShell giữ nguyên dấu phẩy.)
function Join-KubectlArgs($List) {
    foreach ($a in @($List)) {
        if ($a -is [array]) { (@($a) | ForEach-Object { [string]$_ }) -join ',' } else { $a }
    }
}

# In lệnh rồi chạy, luôn trên đúng context. ErrorActionPreference = Continue: cảnh báo kubectl
# ghi ra stderr không được làm dừng script (PowerShell 5.1 coi stderr là lỗi khi bị chuyển hướng);
# kết quả kiểm bằng $LASTEXITCODE ở nơi cần.
# Hàm THƯỜNG dùng $args, không [CmdletBinding()]/[Parameter()]: hàm nâng cao sẽ hiểu -o, -d...
# là tham số chung (-OutVariable, -Debug) thay vì chuyển nguyên cho kubectl.
function kc {
    $kargs = @(Join-KubectlArgs $args)
    Write-Cmd ('kubectl ' + (Format-Args $kargs))
    $prev = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try {
        & kubectl --context $Context @kargs
    } finally {
        $ErrorActionPreference = $prev
    }
}

# Chạy im lặng, trả stdout (chuỗi) hoặc $null nếu lỗi. PowerShell 5.1 biến stderr của lệnh
# ngoài thành lỗi khi chuyển hướng, nên hạ ErrorActionPreference trong lúc gọi.
function Get-Kubectl {
    $kargs = @(Join-KubectlArgs $args)
    $prev = $ErrorActionPreference
    $ErrorActionPreference = 'SilentlyContinue'
    try {
        $out = & kubectl --context $Context @kargs 2>$null
        if ($LASTEXITCODE -ne 0) { return $null }
        return (($out | Out-String).Trim())
    } finally {
        $ErrorActionPreference = $prev
    }
}

function Get-DockerImageId([string]$Name) {
    $prev = $ErrorActionPreference
    $ErrorActionPreference = 'SilentlyContinue'
    try {
        $id = & docker image inspect $Name --format '{{.Id}}' 2>$null
        if ($LASTEXITCODE -ne 0 -or -not $id) { return $null }
        return ([string]$id).Trim()
    } finally {
        $ErrorActionPreference = $prev
    }
}

function Test-DockerImage([string]$Name) { return [bool](Get-DockerImageId $Name) }

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
        throw "Chưa có context '$Context' — bật Kubernetes trong Docker Desktop trước (README, mục 5)."
    }
    $nodes = Get-Kubectl get nodes --no-headers
    if (-not $nodes -or $nodes -notmatch '\sReady\s') {
        throw "Node của cluster '$Context' chưa Ready:`n$nodes"
    }
}

function Get-ServerPods([string]$Namespace = $Ns) {
    $json = Get-Kubectl -n $Namespace get pods -l app=server -o json
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
        $rs = ''
        foreach ($o in @($p.metadata.ownerReferences)) {
            if ($null -ne $o -and $o.kind -eq 'ReplicaSet') { $rs = [string]$o.name }
        }
        $list += [pscustomobject]@{ Name = $p.metadata.name; Ready = $ready; Reason = $reason; Ip = $p.status.podIP; Rs = $rs }
    }
    return $list
}

# Trạng thái rollout, cùng điều kiện "xong" như `kubectl rollout status`: controller đã thấy bản
# sửa mới nhất, đủ pod theo template mới, không còn pod cũ, mọi pod mới đều available.
function Get-RolloutState([string]$Namespace, [string]$Name) {
    $json = Get-Kubectl -n $Namespace get deployment $Name -o json
    if (-not $json) { return $null }
    $d = $json | ConvertFrom-Json
    $s = $d.status
    $want = [int]$d.spec.replicas
    $updated = [int]$s.updatedReplicas
    $total = [int]$s.replicas
    $avail = [int]$s.availableReplicas
    $observed = ([int64]$s.observedGeneration -ge [int64]$d.metadata.generation)
    $timedOut = $false
    foreach ($c in @($s.conditions)) {
        if ($null -ne $c -and $c.type -eq 'Progressing' -and $c.reason -eq 'ProgressDeadlineExceeded') { $timedOut = $true }
    }
    $cause = ''
    $rev = ''
    if ($d.metadata.annotations) {
        $cause = [string]$d.metadata.annotations.'kubernetes.io/change-cause'
        $rev = [string]$d.metadata.annotations.'deployment.kubernetes.io/revision'
    }
    return [pscustomobject]@{
        Want = $want; Updated = $updated; Total = $total; Available = $avail; Ready = [int]$s.readyReplicas
        Complete = ($observed -and $updated -ge $want -and $total -le $updated -and $avail -ge $updated)
        TimedOut = $timedOut
        Image = [string]$d.spec.template.spec.containers[0].image
        Revision = $rev
        ChangeCause = $cause
    }
}

# Tên các ReplicaSet của một Deployment đang có pod — "bản cũ" ngay trước một lần phát hành.
function Get-ActiveRs([string]$Namespace, [string]$Deployment) {
    $json = Get-Kubectl -n $Namespace get replicaset -o json
    if (-not $json) { return }
    foreach ($rs in ($json | ConvertFrom-Json).items) {
        $owned = $false
        foreach ($o in @($rs.metadata.ownerReferences)) {
            if ($null -ne $o -and $o.kind -eq 'Deployment' -and $o.name -eq $Deployment) { $owned = $true }
        }
        if ($owned -and [int]$rs.status.replicas -gt 0) { [string]$rs.metadata.name }
    }
}

function Show-PodTrouble([string]$Namespace = $Ns) {
    kc -n $Namespace get pods -o wide
    foreach ($p in @(Get-ServerPods $Namespace)) {
        if ($p.Reason -eq 'ErrImageNeverPull') {
            Write-Warn "Pod $($p.Name): ErrImageNeverPull — cluster không thấy image của pod này."
            Write-Note '   Gắn tag image: .\demo.ps1 -Step images. Nếu đã có image mà vẫn lỗi: cluster đang dùng kiểu'
            Write-Note '   "kind" (node là container riêng, không chung image store) — dựng lại bằng kiểu Kubeadm.'
            return
        }
        if ($p.Reason -eq 'CrashLoopBackOff' -or $p.Reason -eq 'Error') {
            Write-Warn "Pod $($p.Name): $($p.Reason) — 30 dòng log cuối:"
            kc -n $Namespace logs $p.Name --tail=30
            return
        }
    }
    Write-Note "Xem thêm: kubectl -n $Namespace describe pod <tên-pod>  (mục Events cuối cùng)"
}

# ─── HTTP ──────────────────────────────────────────────────────────────────────

# -DisableKeepAlive: mỗi request một kết nối TCP mới. Service chia theo KẾT NỐI, giữ
# keep-alive thì cả loạt request dính một pod và không thấy được cân bằng tải.
function Invoke-ProbeUrl([string]$Url) {
    $sw = [Diagnostics.Stopwatch]::StartNew()
    try {
        $r = Invoke-WebRequest -Uri $Url -UseBasicParsing -DisableKeepAlive -TimeoutSec 5
        return [pscustomobject]@{ Ok = $true; Status = [int]$r.StatusCode; ServedBy = [string]$r.Headers['X-Served-By']; Ms = $sw.ElapsedMilliseconds; Error = '' }
    } catch {
        $code = 0
        $resp = $_.Exception.Response
        if ($resp) { try { $code = [int]$resp.StatusCode } catch { } }
        return [pscustomobject]@{ Ok = $false; Status = $code; ServedBy = ''; Ms = $sw.ElapsedMilliseconds; Error = $_.Exception.Message }
    }
}

function Invoke-Probe([string]$Path) { return (Invoke-ProbeUrl ($BaseUrl + $Path)) }

# Chờ một URL trả 2xx (Docker Desktop cần vài giây để mở cổng của Service LoadBalancer mới).
function Wait-Url([string]$Url, [int]$Seconds = 90) {
    $deadline = (Get-Date).AddSeconds($Seconds)
    do {
        $p = Invoke-ProbeUrl $Url
        if ($p.Ok) { return $p }
        Start-Sleep -Seconds 3
    } while ((Get-Date) -lt $deadline)
    return $p
}

# ConvertFrom-Json của PowerShell 5.1 từ chối JSON có hai khoá chỉ khác hoa/thường hoặc khoá rỗng
# (dữ liệu sản phẩm có thể có) — khi đó đọc lại bằng JavaScriptSerializer: được Dictionary / mảng,
# truy cập .id / .name vẫn như object thường.
function ConvertFrom-JsonSafe([string]$Text) {
    try { return ($Text | ConvertFrom-Json) } catch { }
    Add-Type -AssemblyName System.Web.Extensions
    $ser = New-Object System.Web.Script.Serialization.JavaScriptSerializer
    $ser.MaxJsonLength = [int]::MaxValue
    return , $ser.DeserializeObject($Text)
}

# GET trả JSON cho smoke test: mã HTTP, pod trả lời, JSON đã parse.
function Invoke-JsonGet([string]$Url) {
    $sw = [Diagnostics.Stopwatch]::StartNew()
    $res = [pscustomobject]@{ Status = 0; Ms = 0; ServedBy = ''; Json = $null; Error = '' }
    try {
        $r = Invoke-WebRequest -Uri $Url -UseBasicParsing -DisableKeepAlive -TimeoutSec 15
        $res.Status = [int]$r.StatusCode
        $res.ServedBy = [string]$r.Headers['X-Served-By']
        try { $res.Json = ConvertFrom-JsonSafe $r.Content } catch { $res.Error = 'body không phải JSON' }
    } catch {
        $resp = $_.Exception.Response
        if ($resp) { try { $res.Status = [int]$resp.StatusCode } catch { } }
        $res.Error = $_.Exception.Message
    }
    $res.Ms = $sw.ElapsedMilliseconds
    return $res
}

# ─── Vòng request nền + đếm theo phiên bản ─────────────────────────────────────

# Chạy trong tiến trình PowerShell riêng (Start-Job) trong lúc xoá pod / phát hành. Mỗi giây phát
# ra một "tick": số response theo TÊN POD (header X-Served-By) + số lỗi + độ trễ lớn nhất, để bên
# chính vẽ dòng thời gian trong lúc job còn chạy (Receive-Job lấy dần). Cuối cùng phát "summary".
$LoopBlock = {
    param([string]$Url, [string]$StopFile, [int]$IntervalMs, [int]$MaxSeconds)
    $ProgressPreference = 'SilentlyContinue'
    $ok = 0
    $fail = 0
    $errors = New-Object System.Collections.ArrayList
    $tick = $null
    $deadline = (Get-Date).AddSeconds($MaxSeconds)
    while (-not (Test-Path -LiteralPath $StopFile) -and (Get-Date) -lt $deadline) {
        $now = Get-Date
        $sec = $now.AddTicks(-($now.Ticks % [TimeSpan]::TicksPerSecond))
        if ($null -eq $tick -or $tick.At -ne $sec) {
            if ($null -ne $tick) { $tick }
            $tick = [pscustomobject]@{ Kind = 'tick'; At = $sec; Pods = @{}; Fail = 0; MaxMs = 0 }
        }
        $sw = [Diagnostics.Stopwatch]::StartNew()
        try {
            $r = Invoke-WebRequest -Uri $Url -UseBasicParsing -DisableKeepAlive -TimeoutSec 5
            $ok++
            $name = [string]$r.Headers['X-Served-By']
            if (-not $name) { $name = '(không có X-Served-By)' }
            $tick.Pods[$name] = 1 + [int]$tick.Pods[$name]
        } catch {
            $fail++
            $tick.Fail = $tick.Fail + 1
            $code = ''
            if ($_.Exception.Response) { try { $code = [int]$_.Exception.Response.StatusCode } catch { } }
            if ($errors.Count -lt 200) { [void]$errors.Add(('{0:HH:mm:ss.fff}  HTTP {1}  {2}' -f $now, $code, $_.Exception.Message)) }
        }
        $ms = [int]$sw.ElapsedMilliseconds
        if ($ms -gt $tick.MaxMs) { $tick.MaxMs = $ms }
        Start-Sleep -Milliseconds $IntervalMs
    }
    if ($null -ne $tick) { $tick }
    [pscustomobject]@{ Kind = 'summary'; Ok = $ok; Fail = $fail; Errors = @($errors) }
}

function Start-RequestLoop([string]$Url, [int]$MaxSeconds = 300, [int]$IntervalMs = 100) {
    $stop = Join-Path $env:TEMP ('getshopy-k8s-demo-stop-' + [guid]::NewGuid().ToString('N'))
    $job = Start-Job -ScriptBlock $LoopBlock -ArgumentList $Url, $stop, $IntervalMs, $MaxSeconds
    [void]$LoopJobs.Add($job)
    Write-Note ("Đã chạy nền vòng request GET {0} mỗi {1} ms, mỗi request một kết nối TCP mới (job {2})." -f $Url, $IntervalMs, $job.Id)
    # Tiến trình nền cần vài giây để khởi động trước khi gây sự cố.
    Start-Sleep -Seconds 4
    return [pscustomobject]@{ Job = $job; StopFile = $stop; Url = $Url; Ticks = (New-Object System.Collections.ArrayList); Summary = $null }
}

# Lấy các tick mới từ job (không chờ), lưu vào handle, trả các tick mới.
function Receive-LoopTicks($Handle) {
    foreach ($o in @(Receive-Job -Job $Handle.Job -ErrorAction SilentlyContinue)) {
        if ($null -eq $o) { continue }
        if ($o.Kind -eq 'summary') { $Handle.Summary = $o; continue }
        [void]$Handle.Ticks.Add($o)
        $o
    }
}

function Stop-RequestLoop($Handle) {
    New-Item -ItemType File -Path $Handle.StopFile -Force | Out-Null
    [void](Wait-Job -Job $Handle.Job -Timeout 30)
    [void]@(Receive-LoopTicks $Handle)
    Remove-Job -Job $Handle.Job -Force -ErrorAction SilentlyContinue
    $LoopJobs.Remove($Handle.Job)
    Remove-Item -LiteralPath $Handle.StopFile -ErrorAction SilentlyContinue
    if ($null -eq $Handle.Summary) {
        Write-Warn 'Vòng request không trả tổng kết (job bị dừng?) — số dưới đây chỉ từ các tick đã nhận.'
        $ok = 0
        $fail = 0
        foreach ($t in $Handle.Ticks) { $fail += [int]$t.Fail; foreach ($k in @($t.Pods.Keys)) { $ok += [int]$t.Pods[$k] } }
        $Handle.Summary = [pscustomobject]@{ Kind = 'summary'; Ok = $ok; Fail = $fail; Errors = @() }
    }
    return $Handle.Summary
}

# Tên pod do ReplicaSet sinh = <tên ReplicaSet>-<5 ký tự>, tên ReplicaSet = <Deployment>-<pod-template-hash>.
# Vì vậy chỉ từ header X-Served-By đã biết response đến từ ReplicaSet (= phiên bản) nào.
function Get-RsOfPod([string]$Pod) {
    if ($Pod -match '^(.+)-[a-z0-9]{5}$') { return $Matches[1] }
    return $Pod
}

# Gộp các tick theo nhóm. $Classify: scriptblock nhận tên ReplicaSet, trả tên nhóm (cũ / mới,
# blue / green); không nhận ra thì vào nhóm "khác".
function Measure-Ticks($Ticks, $Classify) {
    $counts = @{}
    $fail = 0
    $maxMs = 0
    $from = $null
    $to = $null
    foreach ($t in @($Ticks)) {
        if ($null -eq $t) { continue }
        $fail += [int]$t.Fail
        if ([int]$t.MaxMs -gt $maxMs) { $maxMs = [int]$t.MaxMs }
        if ($null -eq $from -or $t.At -lt $from) { $from = $t.At }
        if ($null -eq $to -or $t.At -gt $to) { $to = $t.At }
        foreach ($pod in @($t.Pods.Keys)) {
            $cls = $null
            if ($Classify) { $cls = & $Classify (Get-RsOfPod $pod) }
            if (-not $cls) { $cls = 'khác' }
            $counts[$cls] = [int]$counts[$cls] + [int]$t.Pods[$pod]
        }
    }
    return [pscustomobject]@{ Counts = $counts; Fail = $fail; MaxMs = $maxMs; From = $from; To = $to }
}

# Một dòng của dòng thời gian:  10:31:04   [================########]  cũ  16  mới   8  lỗi  0  chậm nhất  45 ms
# (= bản cũ / blue, # bản mới / green, x lỗi, ? không nhận ra — độ dài theo tỉ lệ response.)
function Write-TrafficLine($M, $Classes) {
    if ($null -eq $M.From) {
        Write-Host ('{0:HH:mm:ss}  (không có response nào trong khoảng này)' -f (Get-Date)) -ForegroundColor Yellow
        return
    }
    $span = '{0:HH:mm:ss}' -f $M.From
    if (($M.To - $M.From).TotalSeconds -ge 3) { $span = '{0:HH:mm:ss}-{1:HH:mm:ss}' -f $M.From, $M.To }
    Write-Host ($span.PadRight(19)) -NoNewline
    $other = [int]$M.Counts['khác']
    $segs = @()
    # Mỗi nhóm một ký tự riêng (không chỉ khác màu) để ảnh chụp đen trắng vẫn đọc được.
    foreach ($c in $Classes) { $segs += [pscustomobject]@{ N = [int]$M.Counts[$c.Name]; Color = $c.Color; Ch = $c.Ch } }
    $segs += [pscustomobject]@{ N = $other; Color = 'Magenta'; Ch = '?' }
    $segs += [pscustomobject]@{ N = [int]$M.Fail; Color = 'Red'; Ch = 'x' }
    $total = 0
    foreach ($s in $segs) { $total += $s.N }
    $width = 24
    Write-Host '[' -NoNewline -ForegroundColor DarkGray
    $cum = 0
    $drawn = 0
    foreach ($s in $segs) {
        $cum += $s.N
        $end = 0
        if ($total -gt 0) { $end = [int][math]::Round($width * $cum / $total) }
        if ($end -gt $drawn) {
            Write-Host (([string]$s.Ch) * ($end - $drawn)) -NoNewline -ForegroundColor $s.Color
            $drawn = $end
        }
    }
    if ($drawn -lt $width) { Write-Host (' ' * ($width - $drawn)) -NoNewline }
    Write-Host ']' -NoNewline -ForegroundColor DarkGray
    foreach ($c in $Classes) { Write-Host ('  {0} {1,3}' -f $c.Name, [int]$M.Counts[$c.Name]) -NoNewline -ForegroundColor $c.Color }
    if ($other -gt 0) { Write-Host ('  khác {0,3}' -f $other) -NoNewline -ForegroundColor Magenta }
    $errColor = 'DarkGray'
    if ($M.Fail -gt 0) { $errColor = 'Red' }
    Write-Host ('  lỗi {0,2}' -f $M.Fail) -NoNewline -ForegroundColor $errColor
    Write-Host ('  chậm nhất {0,4} ms' -f $M.MaxMs) -ForegroundColor DarkGray
}

# In gộp MỘT dòng cho mọi response từ lần in trước (dùng sau một lần dừng chờ Enter).
function Write-TrafficSince($Loop, $Classes, $Classify) {
    $ticks = @(Receive-LoopTicks $Loop)
    if ($ticks.Count -eq 0) { return }
    Write-TrafficLine (Measure-Ticks $ticks $Classify) $Classes
}

# Pod theo nhóm: "pod  cũ: 2 Ready, 1 đang tắt | mới: 0 Ready, 1 chưa Ready (Running)".
function Get-PodSummary([string]$Namespace, $Classes, $Classify) {
    $pods = @(Get-ServerPods $Namespace)
    $parts = @()
    foreach ($c in $Classes) {
        $mine = @($pods | Where-Object { (& $Classify $_.Rs) -eq $c.Name })
        $ready = @($mine | Where-Object { $_.Ready }).Count
        $term = @($mine | Where-Object { $_.Reason -eq 'Terminating' }).Count
        $waiting = @($mine | Where-Object { -not $_.Ready -and $_.Reason -ne 'Terminating' })
        $s = '{0}: {1} Ready' -f $c.Name, $ready
        if ($waiting.Count -gt 0) {
            $s += (', {0} chưa Ready ({1})' -f $waiting.Count, ((@($waiting | ForEach-Object { $_.Reason }) | Select-Object -Unique) -join ', '))
        }
        if ($term -gt 0) { $s += (', {0} đang tắt' -f $term) }
        $parts += $s
    }
    return ('pod  ' + ($parts -join ' | '))
}

# Mỗi $EverySeconds giây: một dòng lưu lượng (response mới, theo nhóm) + trạng thái pod khi nó đổi.
# Dừng khi $Until (scriptblock) trả $true, hoặc hết $MaxSeconds. Trả $true nếu $Until đã đạt.
function Watch-Traffic($Loop, [string]$Namespace, $Classes, $Classify, $Until, [int]$MaxSeconds, [int]$EverySeconds = 2) {
    $deadline = (Get-Date).AddSeconds($MaxSeconds)
    $lastPods = ''
    while ($true) {
        Start-Sleep -Seconds $EverySeconds
        $ticks = @(Receive-LoopTicks $Loop)
        Write-TrafficLine (Measure-Ticks $ticks $Classify) $Classes
        $podText = Get-PodSummary $Namespace $Classes $Classify
        if ($podText -ne $lastPods) {
            Write-Host ('                   ' + $podText) -ForegroundColor DarkGray
            $lastPods = $podText
        }
        if ($null -ne $Until -and (& $Until)) { return $true }
        if ((Get-Date) -ge $deadline) { return $false }
    }
}

function Show-LoopResult($Result, $Loop, $Classes = $null, $Classify = $null) {
    $total = $Result.Ok + $Result.Fail
    $color = 'Green'
    if ($Result.Fail -gt 0) { $color = 'Yellow' }
    Write-Host ''
    Write-Host ('Tổng {0} request: {1} thành công, {2} lỗi' -f $total, $Result.Ok, $Result.Fail) -ForegroundColor $color
    $ticks = @($Loop.Ticks | Sort-Object At)

    if ($Classes) {
        Write-Host ('  {0,-56} {1,8}   {2}' -f 'Nhóm (theo ReplicaSet của pod trả lời)', 'request', 'lần đầu -> lần cuối')
        $all = @($Classes) + @([pscustomobject]@{ Name = 'khác'; Label = 'không nhận ra ReplicaSet'; Color = 'Magenta' })
        foreach ($c in $all) {
            $n = 0
            $first = $null
            $last = $null
            foreach ($t in $ticks) {
                foreach ($pod in @($t.Pods.Keys)) {
                    $cls = & $Classify (Get-RsOfPod $pod)
                    if (-not $cls) { $cls = 'khác' }
                    if ($cls -ne $c.Name) { continue }
                    $n += [int]$t.Pods[$pod]
                    if ($null -eq $first) { $first = $t.At }
                    $last = $t.At
                }
            }
            if ($n -eq 0 -and $c.Name -eq 'khác') { continue }
            $span = '(không có)'
            if ($first) { $span = '{0:HH:mm:ss} -> {1:HH:mm:ss}' -f $first, $last }
            Write-Host ('  {0,-56} {1,8}   {2}' -f ($c.Name + ' = ' + $c.Label), $n, $span) -ForegroundColor $c.Color
        }
    }

    $pods = [ordered]@{}
    foreach ($t in $ticks) {
        foreach ($pod in @($t.Pods.Keys)) {
            if (-not $pods.Contains($pod)) { $pods[$pod] = [pscustomobject]@{ N = 0; First = $t.At; Last = $t.At } }
            $e = $pods[$pod]
            $e.N += [int]$t.Pods[$pod]
            $e.Last = $t.At
        }
    }
    Write-Host ('  {0,-56} {1,8}   {2}' -f 'Pod trả lời (X-Served-By)', 'request', 'lần đầu -> lần cuối')
    foreach ($name in $pods.Keys) {
        $e = $pods[$name]
        Write-Host ('  {0,-56} {1,8}   {2:HH:mm:ss} -> {3:HH:mm:ss}' -f $name, $e.N, $e.First, $e.Last)
    }
    foreach ($err in @($Result.Errors | Select-Object -First 10)) { Write-Warn $err }
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

# "kltn-server:k8s-v2" -> "v2" (giá trị nhãn app.kubernetes.io/version).
function Get-VersionName([string]$Image) {
    $tag = $Image
    if ($Image -match ':([^:/]+)$') { $tag = $Matches[1] }
    if ($tag -match '(v\d+)$') { return $Matches[1] }
    $clean = ($tag -replace '[^A-Za-z0-9_.-]', '-').Trim('-', '.', '_')
    if ($clean.Length -gt 63) { $clean = $clean.Substring(0, 63).Trim('-', '.', '_') }
    if (-not $clean) { $clean = 'unknown' }
    return $clean
}

function Step-Images {
    Write-StepTitle 1 "Image v1 / v2 — gắn tag từ $SourceImage (không build)"
    if (-not (Get-Command docker -ErrorAction SilentlyContinue)) { throw 'Không thấy lệnh docker.' }
    $srcId = Get-DockerImageId $SourceImage
    if (-not $srcId) {
        throw "Không có image $SourceImage trên máy. Script không build image — cần image production có sẵn (hoặc chỉ -SourceImage khác)."
    }

    # Image có tắt êm + X-Served-By không: container tạm, không mạng, BỎ entrypoint (không chạm DB).
    $probeName = 'getshopy-k8s-imgcheck-' + [guid]::NewGuid().ToString('N').Substring(0, 8)
    Write-Cmd "docker run --rm --network none --entrypoint sh $SourceImage -c 'test -f src/lifecycle/gracefulShutdown.js && ...'"
    $prev = $ErrorActionPreference
    $ErrorActionPreference = 'SilentlyContinue'
    & docker run --rm --name $probeName --network none --entrypoint sh $SourceImage -c 'test -f src/lifecycle/gracefulShutdown.js && test -f src/middleware/servedBy.js && grep -q SHUTDOWN_DRAIN_DELAY_MS src/index.js' 2>$null | Out-Null
    $probeExit = $LASTEXITCODE
    $ErrorActionPreference = $prev
    if ($probeExit -eq 0) {
        Write-Good 'Image có tắt êm (gracefulShutdown.js, SHUTDOWN_DRAIN_DELAY_MS) và header X-Served-By.'
    } else {
        Write-Warn "Image $SourceImage KHÔNG có tắt êm / X-Served-By (server cũ hơn 18/11/2026)."
        Write-Warn 'Demo vẫn chạy, nhưng pod cũ bị SIGKILL khi hết hạn thay vì tắt êm, và không đếm được bản cũ / mới.'
    }

    foreach ($tag in @($ImageV1, $ImageV2)) {
        $before = Get-DockerImageId $tag
        Write-Cmd "docker tag $SourceImage $tag"
        & docker tag $SourceImage $tag
        if ($LASTEXITCODE -ne 0) { throw "docker tag $tag thất bại." }
        if ($before -and $before -ne $srcId) { Write-Note "   ($tag trước đó trỏ image khác — nay trỏ $SourceImage)" }
    }
    Write-Host ''
    foreach ($tag in @($SourceImage, $ImageV1, $ImageV2)) {
        Write-Host ('  {0,-28} {1}' -f $tag, (Get-DockerImageId $tag).Substring(0, 19))
    }
    Write-Note ''
    Write-Note 'v1 và v2 là CÙNG MỘT image (cùng ID ở trên) — nói thẳng khi trình bày. Thứ được minh hoạ là CƠ CHẾ'
    Write-Note 'phát hành: đổi image trong pod template thì Kubernetes tạo ReplicaSet mới, thay pod theo chiến lược'
    Write-Note 'đã khai báo, giữ ReplicaSet cũ để quay lui. Bản v2 có code khác cũng đi đúng con đường đó.'
}

function Step-Apply {
    Write-StepTitle 2 "Triển khai tầng ứng dụng lên Kubernetes ($ImageV1)"
    Assert-Cluster
    if (-not (Test-DockerImage $ImageV1)) {
        Write-Warn "Chưa có image '$ImageV1'. Gắn tag từ image production (không build):"
        Write-Note '   .\demo.ps1 -Step images'
        throw 'Thiếu image server.'
    }
    Show-Ram 'trước khi apply'

    kc apply -f (Join-Path $Here 'manifests\00-namespace.yaml')
    Write-Cmd '.\make-secret.ps1   (Secret server-env từ .env production, không in giá trị)'
    $secretArgs = @{ Context = $Context; Namespace = $Ns; PgPoolPerPod = $PgPoolPerPod }
    if ($ProjectDir) { $secretArgs['ProjectDir'] = $ProjectDir }
    & (Join-Path $Here 'make-secret.ps1') @secretArgs

    kc apply -k (Join-Path $Here 'metrics-server')
    kc apply -f (Join-Path $Here 'manifests\10-configmap.yaml')
    $deploy = Get-Content -LiteralPath (Join-Path $Here 'manifests\20-deployment.yaml') -Raw -Encoding UTF8
    if ($ImageV1 -ne $DefaultV1) { $deploy = $deploy.Replace($DefaultV1, $ImageV1) }
    Write-Cmd "kubectl apply -f manifests\20-deployment.yaml   (image: $ImageV1)"
    Invoke-ApplyText $deploy
    kc apply -f (Join-Path $Here 'manifests\30-service.yaml')
    kc apply -f (Join-Path $Here 'manifests\40-hpa.yaml')

    Write-Host ''
    kc -n $Ns rollout status deployment/server --timeout=180s
    if ($LASTEXITCODE -ne 0) {
        Show-PodTrouble $Ns
        throw 'Deployment server chưa sẵn sàng sau 180 s.'
    }

    Write-Note "Chờ Docker Desktop mở Service LoadBalancer ở $BaseUrl ..."
    $probe = Wait-Url ($BaseUrl + '/api/health') 90
    if (-not $probe.Ok) {
        kc -n $Ns get service server
        throw "Không gọi được $BaseUrl/api/health: $($probe.Error)"
    }
    Write-Good ("$BaseUrl/api/health -> HTTP {0}, trả lời bởi pod: {1}" -f $probe.Status, $probe.ServedBy)
    if (-not $probe.ServedBy) { Write-Note '(Image không có header X-Served-By — bước lb sẽ đếm theo log từng pod.)' }
    Show-PortBinding $Port

    Write-Host ''
    kc -n kube-system rollout status deployment/metrics-server --timeout=180s
    if ($LASTEXITCODE -ne 0) { Write-Warn 'metrics-server chưa sẵn sàng — HPA sẽ báo <unknown> cho tới khi có số CPU.' }
    Show-Ram 'sau khi apply'
}

function Show-PortBinding([int]$P) {
    $addrs = @()
    try {
        $addrs = @(Get-NetTCPConnection -State Listen -LocalPort $P -ErrorAction Stop | Select-Object -ExpandProperty LocalAddress -Unique)
    } catch { }
    if ($addrs.Count -eq 0) {
        Write-Note "Không thấy tiến trình Windows nào nghe cổng $P (kiểm tay: netstat -ano | findstr :$P)."
        return
    }
    Write-Host ('Cổng {0} đang nghe trên: {1}' -f $P, ($addrs -join ', '))
    if (@($addrs | Where-Object { $_ -eq '0.0.0.0' -or $_ -eq '::' }).Count -gt 0) {
        Write-Warn "Cổng $P mở trên MỌI địa chỉ của máy: máy khác cùng mạng gọi thẳng được API demo (không qua gateway)."
        Write-Warn 'Chỉ demo trên mạng tin cậy, và dọn (bước teardown) ngay sau buổi demo.'
    }
}

function Step-Pods {
    Write-StepTitle 3 'Pod, Deployment, ReplicaSet, Service, HPA'
    kc -n $Ns get pods -o wide
    Write-Host ''
    kc -n $Ns get deployment,replicaset -o wide -L app.kubernetes.io/version
    Write-Host ''
    kc -n $Ns get service,hpa
    Write-Host ''
    kc -n $Ns get endpointslices -l kubernetes.io/service-name=server
    Write-Note ''
    Write-Note 'Deployment giữ số pod mong muốn qua ReplicaSet; Service gom các pod Ready (EndpointSlice ở trên)'
    Write-Note "sau một địa chỉ duy nhất; Docker Desktop đưa Service LoadBalancer ra $BaseUrl."
}

function Step-Lb {
    Write-StepTitle 4 "Cân bằng tải: 20 request vào $BaseUrl/api/health"
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
        foreach ($p in @(Get-ServerPods $Ns)) {
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
    Write-StepTitle 5 'Tự phục hồi: xoá một pod đang phục vụ'
    kc -n $Ns get pods -o wide
    $victim = @(Get-ServerPods $Ns | Where-Object { $_.Ready } | Select-Object -First 1)
    if ($victim.Count -eq 0) { throw 'Không có pod server nào Ready.' }
    $victimName = $victim[0].Name

    $loop = Start-RequestLoop -Url ($BaseUrl + $LoopPath) -MaxSeconds 120 -IntervalMs 200
    Write-Host ''
    Write-Event "Xoá pod $victimName"
    kc -n $Ns delete pod $victimName --wait=false

    # Theo dõi tới khi lại đủ 2 pod Ready (không tính pod vừa xoá), tối đa 90 s.
    $deadline = (Get-Date).AddSeconds(90)
    do {
        Start-Sleep -Seconds 2
        $pods = @(Get-ServerPods $Ns)
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
    Show-LoopResult $result $loop
    Write-Host ''
    kc -n $Ns get pods -o wide
    Write-Note ''
    Write-Note 'ReplicaSet thấy thiếu pod so với số mong muốn và tạo pod mới ngay. Pod bị xoá nhận SIGTERM: Service gỡ'
    Write-Note 'nó khỏi danh sách, còn nó vẫn trả lời thêm 5 s (drain) rồi mới đóng cổng và thoát — request tới nó'
    Write-Note 'lúc luật định tuyến chưa kịp đổi vẫn được phục vụ.'
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
    Write-StepTitle 6 'Tự co giãn (HPA) dưới tải'
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

# Trước một lần phát hành trên Deployment server: phải đang ở trạng thái xong (không dở rollout nào).
# Ngay sau bước heal / hpa, pod mới có thể Ready nhưng chưa đủ 5 s (minReadySeconds) hoặc HPA vừa đổi
# số pod — `rollout status` cũng coi đó là "chưa xong". Chờ tối đa 60 s cho ổn định rồi mới kết luận.
function Assert-RolloutIdle {
    $state = Get-RolloutState $Ns 'server'
    if (-not $state) { throw 'Chưa có Deployment server — chạy .\demo.ps1 -Step apply trước.' }
    if (-not $state.Complete) {
        Write-Note 'Deployment server chưa ổn định (pod mới chưa available / HPA vừa đổi số pod) — chờ tối đa 60 s...'
        $deadline = (Get-Date).AddSeconds(60)
        while (-not $state.Complete -and (Get-Date) -lt $deadline) {
            Start-Sleep -Seconds 2
            $state = Get-RolloutState $Ns 'server'
        }
    }
    if (-not $state.Complete) {
        kc -n $Ns rollout status deployment/server --timeout=5s
        Write-Warn 'Deployment server đang dở một lần phát hành (có thể là bản lỗi của bước badrelease bị ngắt giữa chừng).'
        Write-Note "   Quay về bản tốt trước đó:  kubectl --context $Context -n $Ns rollout undo deployment/server"
        throw 'Deployment chưa ở trạng thái ổn định.'
    }
    return $state
}

# Hai nhóm "cũ" / "mới" theo ReplicaSet có pod NGAY TRƯỚC khi phát hành.
function New-OldNewClasses([string[]]$OldRs, [string]$OldLabel, [string]$NewLabel, [string]$NewColor = 'Green') {
    $classes = @(
        [pscustomobject]@{ Name = 'cũ'; Label = $OldLabel; Color = 'Cyan'; Ch = '=' },
        [pscustomobject]@{ Name = 'mới'; Label = $NewLabel; Color = $NewColor; Ch = '#' }
    )
    # GetNewClosure giữ $OldRs của lần gọi này. Trong closure chỉ dùng toán tử, không gọi hàm của
    # script (closure chạy trong module động, không thấy hàm khai báo ở phạm vi script).
    $classify = { param($rs) if ($OldRs -contains $rs) { 'cũ' } elseif ($rs) { 'mới' } }.GetNewClosure()
    return [pscustomobject]@{ Classes = $classes; Classify = $classify }
}

function Wait-NoTerminating([string]$Namespace, $Loop, $Classes, $Classify, [int]$MaxSeconds = 60) {
    $until = { @(Get-ServerPods $Namespace | Where-Object { $_.Reason -eq 'Terminating' }).Count -eq 0 }
    [void](Watch-Traffic -Loop $Loop -Namespace $Namespace -Classes $Classes -Classify $Classify -Until $until -MaxSeconds $MaxSeconds)
}

function Step-Rolling {
    Write-StepTitle 7 'Nâng cấp cuốn chiếu v1 -> v2 (kubectl set image) trong lúc khách vẫn gọi'
    $before = Assert-RolloutIdle
    $from = $before.Image
    $to = $ImageV2
    if ($from -eq $ImageV2) {
        $to = $ImageV1
        Write-Warn "Deployment đã chạy $ImageV2 (nâng cấp ở lần chạy trước) — lần này đổi về $ImageV1 để vẫn có một lần phát hành thật."
    }
    if (-not (Test-DockerImage $to)) { throw "Chưa có image $to — chạy .\demo.ps1 -Step images." }
    $ver = Get-VersionName $to
    $oldRs = @(Get-ActiveRs $Ns 'server')
    $cls = New-OldNewClasses $oldRs ('{0} ({1})' -f ($oldRs -join ', '), $from) ('ReplicaSet mới ({0})' -f $to)

    kc -n $Ns get deployment,replicaset -o wide
    Write-Note ''
    Write-Note ("Phát hành {0} -> {1}. (v1 và v2 là cùng một image gắn hai tag — thứ được minh hoạ là cơ chế.)" -f $from, $to)
    Write-Note 'Đổi image trong pod template => Deployment tạo ReplicaSet mới rồi lặp lại cho tới khi hết pod cũ:'
    Write-Note '  1. thêm 1 pod mới (maxSurge=1); /api/health đạt 2 lần liên tiếp (readinessProbe) => pod vào Service;'
    Write-Note '  2. pod mới Ready đủ 5 s (minReadySeconds) => bỏ 1 pod cũ — maxUnavailable=0: không lúc nào thiếu pod;'
    Write-Note '  3. pod cũ nhận SIGTERM: vẫn phục vụ thêm 5 s trong lúc Service gỡ nó (SHUTDOWN_DRAIN_DELAY_MS),'
    Write-Note '     trả lời nốt request dở dang, đóng kết nối DB, thoát (tối đa 20 s; Kubernetes chờ tới 30 s).'
    Write-Note ("Mỗi dòng dưới đây = 2 giây response của GET {0}{1}, nhóm theo ReplicaSet của pod trả lời" -f $BaseUrl, $LoopPath)
    Write-Note '(tên pod trong header X-Served-By): "=" cyan = bản cũ, "#" xanh lá = bản mới, "x" đỏ = lỗi.'
    Wait-Enter 'Nhấn Enter để phát hành'

    $loop = Start-RequestLoop -Url ($BaseUrl + $LoopPath) -MaxSeconds 600 -IntervalMs 100
    Write-Host ''
    Write-Event "Phát hành $to"
    kc -n $Ns set image deployment/server "server=$to"
    kc -n $Ns annotate deployment/server "kubernetes.io/change-cause=${ver}: kubectl set image server=$to" --overwrite
    kc -n $Ns label deployment/server "app.kubernetes.io/version=$ver" --overwrite
    $done = Watch-Traffic -Loop $loop -Namespace $Ns -Classes $cls.Classes -Classify $cls.Classify -Until { (Get-RolloutState $Ns 'server').Complete } -MaxSeconds 300
    if ($done) {
        Write-Event 'Rollout xong — chờ pod cũ cuối cùng tắt êm'
    } else {
        Write-Warn 'Rollout chưa xong sau 300 s.'
        Show-PodTrouble $Ns
    }
    Wait-NoTerminating $Ns $loop $cls.Classes $cls.Classify 60
    $result = Stop-RequestLoop $loop
    $newRs = @(Get-ActiveRs $Ns 'server' | Where-Object { $oldRs -notcontains $_ })
    if ($newRs.Count -gt 0) { $cls.Classes[1].Label = '{0} ({1})' -f ($newRs -join ', '), $to }
    Show-LoopResult $result $loop $cls.Classes $cls.Classify

    Write-Host ''
    kc -n $Ns rollout status deployment/server --timeout=10s
    kc -n $Ns get replicaset -o wide
    kc -n $Ns rollout history deployment/server
    Write-Note ''
    Write-Note 'Đọc kết quả: các dòng chuyển dần từ cyan sang xanh lá; có lúc CẢ HAI bản cùng trả lời — đặc điểm của'
    Write-Note 'rolling update (khách có thể gặp v1 rồi v2 trong vài giây). Số lỗi mục tiêu: 0. ReplicaSet cũ còn lại với'
    Write-Note '0 pod — đó là bản lưu để `kubectl rollout undo` quay về (bước tiếp theo).'
}

function Step-BadRelease {
    Write-StepTitle 8 'Bản phát hành LỖI: không pod lỗi nào nhận khách, rồi rollout undo'
    $before = Assert-RolloutIdle
    $oldRs = @(Get-ActiveRs $Ns 'server')
    if ($BadRelease -eq 'image') {
        $badArgs = @('set', 'image', 'deployment/server', "server=$BrokenImage")
        $cause = "LỖI CỐ Ý: image $BrokenImage không có trên máy"
        $what = "image $BrokenImage (không tồn tại)"
        $short = 'image không tồn tại'
        $expect = 'Pod mới kẹt ở ErrImageNeverPull: container không bao giờ chạy, nên không bao giờ Ready.'
    } else {
        $badArgs = @('set', 'env', 'deployment/server', "PORT=$BadPort")
        $cause = "LỖI CỐ Ý: PORT=$BadPort, app không nghe ở cổng 8080 nên readiness không bao giờ đạt"
        $what = "$($before.Image) + biến PORT=$BadPort (cấu hình sai)"
        $short = "PORT=$BadPort"
        $expect = "Pod mới Running nhưng app nghe ở :$BadPort; readinessProbe gọi :8080/api/health bị từ chối => không bao giờ Ready."
    }
    $cls = New-OldNewClasses $oldRs ('{0} ({1}, rev {2})' -f ($oldRs -join ', '), $before.Image, $before.Revision) ("ReplicaSet bản lỗi ($short)") 'Yellow'

    kc -n $Ns get pods -o wide
    Write-Note ''
    Write-Note "Giả lập một bản phát hành hỏng: $what."
    Write-Note $expect
    Write-Note 'Kỳ vọng: maxUnavailable=0 nên Deployment KHÔNG bỏ pod cũ nào khi pod mới chưa available; Service chỉ'
    Write-Note 'gửi khách tới pod Ready => khách vẫn 100% ở bản cũ, 0 lỗi. Rollout đứng yên, `rollout status` hết hạn chờ.'
    Wait-Enter 'Nhấn Enter để phát hành bản lỗi'

    $loop = Start-RequestLoop -Url ($BaseUrl + $LoopPath) -MaxSeconds 900 -IntervalMs 100
    Write-Host ''
    Write-Event "Phát hành bản lỗi: $what"
    kc -n $Ns @badArgs
    kc -n $Ns annotate deployment/server "kubernetes.io/change-cause=$cause" --overwrite
    [void](Watch-Traffic -Loop $loop -Namespace $Ns -Classes $cls.Classes -Classify $cls.Classify -Until $null -MaxSeconds 20)

    Write-Host ''
    Write-Note 'CI/CD thật chờ rollout có hạn — hết hạn là tín hiệu dừng và quay lui:'
    kc -n $Ns rollout status deployment/server --timeout=15s
    $statusExit = $LASTEXITCODE
    Write-TrafficSince $loop $cls.Classes $cls.Classify
    if ($statusExit -ne 0) {
        Write-Good "rollout status thoát mã $statusExit (hết hạn) — bản lỗi KHÔNG được coi là đã phát hành, khách không chạm tới nó."
    } else {
        Write-Warn 'rollout status lại báo xong — bản "lỗi" đã Ready? Xem kubectl get pods.'
    }
    kc -n $Ns get pods -o wide
    Write-Note 'Sau progressDeadlineSeconds (90 s) không tiến triển, Deployment còn ghi điều kiện ProgressDeadlineExceeded'
    Write-Note '(kubectl describe deployment server). Kubernetes không tự quay lui — người / pipeline quyết định.'

    Wait-Enter 'Nhấn Enter để quay lui: kubectl rollout undo'
    Write-TrafficSince $loop $cls.Classes $cls.Classify
    Write-Event 'rollout undo'
    kc -n $Ns rollout undo deployment/server
    $done = Watch-Traffic -Loop $loop -Namespace $Ns -Classes $cls.Classes -Classify $cls.Classify -Until { (Get-RolloutState $Ns 'server').Complete } -MaxSeconds 120
    if (-not $done) { Write-Warn 'Undo chưa xong sau 120 s.'; Show-PodTrouble $Ns }
    Wait-NoTerminating $Ns $loop $cls.Classes $cls.Classify 60
    $result = Stop-RequestLoop $loop
    Show-LoopResult $result $loop $cls.Classes $cls.Classify

    Write-Host ''
    kc -n $Ns rollout status deployment/server --timeout=10s
    kc -n $Ns get pods -o wide
    kc -n $Ns rollout history deployment/server
    Write-Note ''
    Write-Note 'Undo không tạo pod mới: template quay về đúng revision trước, ReplicaSet của nó vẫn đang chạy đủ pod, chỉ'
    Write-Note 'ReplicaSet lỗi bị thu về 0. Trong history, revision tốt được đánh số lại thành revision mới nhất.'
}

# Đọc manifest blue/green, thay image (nếu -ImageV1/-ImageV2 khác mặc định) và số pod (-BgReplicas).
function Get-BgYaml([string]$File, [string]$Image, [string]$DefaultImage) {
    $yaml = Get-Content -LiteralPath (Join-Path $Here $File) -Raw -Encoding UTF8
    if ($Image -ne $DefaultImage) { $yaml = $yaml.Replace($DefaultImage, $Image) }
    $yaml = [regex]::Replace($yaml, '(?m)^(  replicas: )\d+(\r?)$', ('${1}' + $BgReplicas + '${2}'))
    Write-Cmd ("kubectl apply -f {0}   (image: {1}, replicas: {2})" -f $File, $Image, $BgReplicas)
    return $yaml
}

# In một dòng kết quả smoke test; trả @{ Ok; Reason }. Pod trả lời phải là pod green (tiền tố tên).
function Write-SmokeLine([string]$Name, $Resp, [bool]$Ok, [string]$PassText, [string]$Expect, [string]$PodPrefix) {
    $why = ''
    if (-not $Ok) {
        $why = 'cần: ' + $Expect
        if ($Resp.Error) { $why += ' — ' + $Resp.Error }
    } elseif ($PodPrefix -and -not ($Resp.ServedBy -like ($PodPrefix + '*'))) {
        $Ok = $false
        $why = 'trả lời bởi "' + $Resp.ServedBy + '", không phải pod ' + $PodPrefix + '*'
    }
    $tag = '[ĐẠT] '
    $color = 'Green'
    $text = $PassText
    if (-not $Ok) { $tag = '[HỎNG]'; $color = 'Red'; $text = $why }
    $who = $Resp.ServedBy
    if (-not $who) { $who = '-' }
    Write-Host ('  {0} {1,-32} HTTP {2,3} {3,5} ms  {4,-34} {5}' -f $tag, $Name, $Resp.Status, $Resp.Ms, $who, $text) -ForegroundColor $color
    return [pscustomobject]@{ Ok = $Ok; Reason = ($Name + ': ' + $why) }
}

# Smoke test CHỈ ĐỌC qua cổng xem trước: health, danh mục, danh sách sản phẩm, chi tiết sản phẩm.
# Kiểm mã HTTP + hình dạng JSON tối thiểu + pod trả lời đúng là bản mới. Không POST / ghi gì.
function Invoke-SmokeTests([string]$Base, [string]$PodPrefix) {
    $results = @()

    $r = Invoke-JsonGet ($Base + '/api/health')
    $ok = ($r.Status -eq 200 -and $null -ne $r.Json -and $r.Json.status -eq 'ok')
    $pass = ''
    if ($null -ne $r.Json) { $pass = 'status=' + $r.Json.status + ', clickhouse=' + $r.Json.clickhouse }
    $results += Write-SmokeLine 'GET /api/health' $r $ok $pass '200, JSON status = "ok"' $PodPrefix

    $r = Invoke-JsonGet ($Base + '/api/b2c/categories')
    $cats = @()
    if ($null -ne $r.Json) { $cats = @($r.Json) }
    $ok = ($r.Status -eq 200 -and $cats.Count -ge 1 -and $null -ne $cats[0].id -and [string]$cats[0].name)
    $results += Write-SmokeLine 'GET /api/b2c/categories' $r $ok ('{0} danh mục' -f $cats.Count) '200, mảng >= 1 danh mục có id, name' $PodPrefix

    $r = Invoke-JsonGet ($Base + '/api/b2c/products?limit=5')
    $items = @()
    if ($null -ne $r.Json -and $null -ne $r.Json.data) { $items = @($r.Json.data) }
    $total = ''
    if ($null -ne $r.Json) { $total = [string]$r.Json.total }
    $ok = ($r.Status -eq 200 -and $items.Count -ge 1 -and $null -ne $items[0].id -and [string]$items[0].name -and $total -match '^\d+$')
    $results += Write-SmokeLine 'GET /api/b2c/products?limit=5' $r $ok ('{0} sản phẩm, total={1}' -f $items.Count, $total) '200, { data: [>= 1 sản phẩm có id, name], total: số }' $PodPrefix

    if ($items.Count -ge 1 -and $null -ne $items[0].id) {
        $id = [string]$items[0].id
        $r = Invoke-JsonGet ($Base + '/api/b2c/products/' + $id)
        $ok = ($r.Status -eq 200 -and $null -ne $r.Json -and [string]$r.Json.id -eq $id -and [string]$r.Json.name)
        $results += Write-SmokeLine ('GET /api/b2c/products/' + $id) $r $ok ('id={0} khớp' -f $id) "200, JSON id = $id, có name" $PodPrefix
    } else {
        $results += [pscustomobject]@{ Ok = $false; Reason = 'GET /api/b2c/products/:id: bỏ qua — không lấy được id sản phẩm ở bước trước' }
        Write-Host '  [HỎNG] GET /api/b2c/products/:id      bỏ qua — không lấy được id sản phẩm ở bước trước' -ForegroundColor Red
    }

    $failed = @($results | Where-Object { -not $_.Ok })
    $reason = ''
    if ($failed.Count -gt 0) { $reason = $failed[0].Reason }
    return [pscustomobject]@{ Ok = ($failed.Count -eq 0); Reason = $reason; Passed = $results.Count - $failed.Count; Total = $results.Count }
}

function Step-BlueGreen {
    Write-StepTitle 9 'Blue-green: chạy song song bản mới, kiểm thử qua cổng xem trước, rồi mới chuyển khách'
    Assert-Cluster
    foreach ($img in @($ImageV1, $ImageV2)) {
        if (-not (Test-DockerImage $img)) { throw "Chưa có image $img — chạy .\demo.ps1 -Step images." }
    }
    Write-Note "Namespace riêng $BgNs — Deployment server / HPA ở $Ns không bị đụng:"
    Write-Note "  server-blue  ($ImageV1, nhãn track=blue)    server-green ($ImageV2, nhãn track=green)"
    Write-Note "  Service server          :$BgPort  cổng KHÁCH — chọn đúng MỘT track"
    Write-Note "  Service server-preview  :$PreviewPort  cổng XEM TRƯỚC — chỉ chọn green, để kiểm thử trước khi khách tới"
    $mainPods = @(Get-ServerPods $Ns).Count
    Write-Note ("Kết nối Postgres tối đa của demo trong bước này: ({0} pod ở {1} + 2 màu x {2} pod) x {3} = {4}." -f $mainPods, $Ns, $BgReplicas, $PgPoolPerPod, (($mainPods + 2 * $BgReplicas) * $PgPoolPerPod))

    # ── Chuẩn bị: chỉ có blue, khách ở blue ──────────────────────────────────────
    Write-Host ''
    Write-Host "Chuẩn bị: blue (v1) phục vụ khách ở $BgUrl" -ForegroundColor Cyan
    kc apply -f (Join-Path $Here 'bluegreen\00-namespace.yaml')
    Write-Cmd ".\make-secret.ps1 -Namespace $BgNs   (Secret server-env, không in giá trị)"
    $secretArgs = @{ Context = $Context; Namespace = $BgNs; PgPoolPerPod = $PgPoolPerPod }
    if ($ProjectDir) { $secretArgs['ProjectDir'] = $ProjectDir }
    & (Join-Path $Here 'make-secret.ps1') @secretArgs
    kc apply -f (Join-Path $Here 'bluegreen\10-configmap.yaml')
    if (Get-Kubectl -n $BgNs get deployment server-green -o name) {
        Write-Note 'Lần chạy trước còn green — xoá để bắt đầu lại từ "chỉ có blue".'
        kc -n $BgNs delete deployment server-green --wait=true
        [void](Get-Kubectl -n $BgNs wait --for=delete pod -l track=green --timeout=60s)
    }
    Invoke-ApplyText (Get-BgYaml 'bluegreen\20-blue.yaml' $ImageV1 $DefaultV1)
    kc apply -f (Join-Path $Here 'bluegreen\30-services.yaml')
    kc -n $BgNs rollout status deployment/server-blue --timeout=180s
    if ($LASTEXITCODE -ne 0) { Show-PodTrouble $BgNs; throw 'Blue chưa sẵn sàng sau 180 s.' }
    $p = Wait-Url ($BgUrl + '/api/health') 90
    if (-not $p.Ok) {
        kc -n $BgNs get service
        throw "Không gọi được $BgUrl/api/health: $($p.Error)"
    }
    Write-Good ('{0} -> HTTP {1}, trả lời bởi {2}' -f $BgUrl, $p.Status, $p.ServedBy)
    Show-PortBinding $BgPort
    kc -n $BgNs get deployment,service -o wide

    $classes = @(
        [pscustomobject]@{ Name = 'blue'; Label = "server-blue, $ImageV1"; Color = 'Cyan'; Ch = '=' },
        [pscustomobject]@{ Name = 'green'; Label = "server-green, $ImageV2"; Color = 'Green'; Ch = '#' }
    )
    $classify = { param($rs) if ($rs -like 'server-blue-*') { 'blue' } elseif ($rs -like 'server-green-*') { 'green' } }

    Write-Note ''
    Write-Note "Vòng request đóng vai khách: GET $BgUrl$LoopPath ~10 lần/giây, chạy suốt bước này."
    Write-Note 'Mỗi dòng = 2 giây response, theo pod trả lời: "=" cyan = blue, "#" xanh lá = green, "x" đỏ = lỗi.'
    Wait-Enter 'Nhấn Enter để triển khai green (v2) SONG SONG — khách vẫn ở blue'

    # ── 1. Triển khai green: chưa khách nào tới được, chỉ cổng preview ────────────
    $loop = Start-RequestLoop -Url ($BgUrl + $LoopPath) -MaxSeconds 1200 -IntervalMs 100
    Write-Host ''
    Write-Event 'Triển khai green'
    Invoke-ApplyText (Get-BgYaml 'bluegreen\21-green.yaml' $ImageV2 $DefaultV2)
    $greenOk = Watch-Traffic -Loop $loop -Namespace $BgNs -Classes $classes -Classify $classify -Until { (Get-RolloutState $BgNs 'server-green').Complete } -MaxSeconds 180

    # ── 2. Smoke test qua cổng preview ───────────────────────────────────────────
    $reason = ''
    $smokeOk = $false
    if (-not $greenOk) {
        $reason = 'green không Ready sau 180 s'
        Show-PodTrouble $BgNs
    } else {
        Write-Good 'green đã Ready — nhưng khách vẫn 100% ở blue: Service khách chưa chọn track=green.'
        Write-Host ''
        Write-Host "Smoke test qua cổng XEM TRƯỚC $PreviewUrl (chỉ GET, không ghi gì vào DB):" -ForegroundColor Cyan
        $pp = Wait-Url ($PreviewUrl + '/api/health') 60
        if (-not $pp.Ok) {
            $reason = "không gọi được $PreviewUrl ($($pp.Error))"
        } else {
            $smoke = Invoke-SmokeTests $PreviewUrl 'server-green-'
            $smokeOk = $smoke.Ok
            if ($smokeOk) { Write-Good ('Smoke test đạt {0}/{1}.' -f $smoke.Passed, $smoke.Total) } else { $reason = $smoke.Reason }
        }
    }
    Write-TrafficSince $loop $classes $classify

    if (-not $smokeOk) {
        Write-Host ''
        Write-Warn "KHÔNG chuyển khách sang green — $reason."
        Write-Event 'Xoá green'
        kc -n $BgNs delete deployment server-green --wait=false
        Start-Sleep -Seconds 3
        $result = Stop-RequestLoop $loop
        Show-LoopResult $result $loop $classes $classify
        Write-Note ''
        Write-Note 'Khách không hề chạm tới green; blue vẫn phục vụ như trước. Sửa bản mới rồi chạy lại -Step bluegreen.'
        return
    }

    Show-Ram 'blue + green cùng chạy (chi phí của blue-green)'
    Wait-Enter 'Nhấn Enter để CHUYỂN khách sang green (đổi selector của Service "server")'

    # ── 3. Chuyển khách: một lần đổi selector ────────────────────────────────────
    Write-TrafficSince $loop $classes $classify
    Write-Event 'Chuyển Service server: track=blue -> track=green'
    kc -n $BgNs set selector service/server 'app=server,track=green'
    if ($LASTEXITCODE -ne 0) { Write-Warn 'Đổi selector thất bại — khách vẫn ở blue.' }
    [void](Watch-Traffic -Loop $loop -Namespace $BgNs -Classes $classes -Classify $classify -Until $null -MaxSeconds 10)
    kc -n $BgNs get endpointslices -l kubernetes.io/service-name=server
    Write-Host ''
    Write-Host 'Rollback lúc này (blue vẫn chạy, chưa thu về) — một lệnh, tức thì:' -ForegroundColor Cyan
    Write-Host ("  kubectl --context {0} -n {1} set selector service/server 'app=server,track=blue'" -f $Context, $BgNs) -ForegroundColor White
    Wait-Enter 'Nhấn Enter để thu blue về 0 pod (blue tắt êm)'

    # ── 4. Thu blue về 0 ─────────────────────────────────────────────────────────
    Write-TrafficSince $loop $classes $classify
    Write-Event 'Thu blue về 0 pod'
    kc -n $BgNs scale deployment/server-blue --replicas=0
    $blueGone = { @(Get-ServerPods $BgNs | Where-Object { $_.Rs -like 'server-blue-*' }).Count -eq 0 }
    [void](Watch-Traffic -Loop $loop -Namespace $BgNs -Classes $classes -Classify $classify -Until $blueGone -MaxSeconds 60)
    $result = Stop-RequestLoop $loop
    Show-LoopResult $result $loop $classes $classify

    Write-Host ''
    kc -n $BgNs get deployment,replicaset,service -o wide
    Write-Host ''
    Write-Host 'Rollback từ đây (blue đã về 0): bật lại blue, đợi Ready, RỒI mới chuyển selector — một dòng:' -ForegroundColor Cyan
    Write-Host ("  kubectl --context {0} -n {1} scale deployment/server-blue --replicas={2}; kubectl --context {0} -n {1} rollout status deployment/server-blue; kubectl --context {0} -n {1} set selector service/server 'app=server,track=blue'" -f $Context, $BgNs, $BgReplicas) -ForegroundColor White
    Write-Note ''
    Write-Note 'So với rolling update: khách đổi bản MỘT lần, không có lúc hai bản cùng trả lời; bản mới được kiểm thử'
    Write-Note 'nghiệp vụ trên đúng pod sẽ nhận khách trước khi chuyển; rollback tức thì khi blue còn chạy. Đổi lại: hai'
    Write-Note 'bộ pod cùng chạy trong lúc chuyển (xem số RAM ở trên).'
}

function Step-Teardown {
    Write-StepTitle 10 'Dọn dẹp'
    Show-Ram 'trước khi dọn'
    kc delete namespace $Ns $BgNs --ignore-not-found --wait=true --timeout=180s
    kc delete -k (Join-Path $Here 'metrics-server') --ignore-not-found
    Show-Ram 'sau khi dọn — Kubernetes vẫn đang bật'
    Write-Host ''
    Write-Host 'Trả lại RAM cho production: tắt hẳn Kubernetes.' -ForegroundColor Cyan
    Write-Note '  Docker Desktop -> Kubernetes -> Stop (bản cũ: Settings -> Kubernetes -> bỏ "Enable Kubernetes" -> Apply).'
    Write-Note '  Sau đó: .\demo.ps1 -Step ram   để so với số gốc.'
    Write-Note "  Tag $ImageV1 / $ImageV2 không chiếm thêm chỗ (cùng image với $SourceImage); gỡ tag: docker image rm $ImageV1 $ImageV2"
}

# ─── Chạy ──────────────────────────────────────────────────────────────────────

$prevConsoleEncoding = [Console]::OutputEncoding
try {
    try { [Console]::OutputEncoding = $Utf8 } catch { }
    switch ($Step) {
        'baseline'   { Step-Baseline }
        'ram'        { Show-Ram 'hiện tại' }
        'images'     { Step-Images }
        'apply'      { Step-Apply }
        'teardown'   { Assert-Cluster; Step-Teardown }
        'pods'       { Assert-Cluster; Step-Pods }
        'lb'         { Assert-Cluster; Step-Lb }
        'heal'       { Assert-Cluster; Step-Heal }
        'hpa'        { Assert-Cluster; Step-Hpa }
        'rolling'    { Assert-Cluster; Step-Rolling }
        'badrelease' { Assert-Cluster; Step-BadRelease }
        'bluegreen'  { Step-BlueGreen }
        'all' {
            Step-Images
            Wait-Enter
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
            Wait-Enter
            Step-BadRelease
            Wait-Enter
            Step-BlueGreen
            Wait-Enter 'Nhấn Enter để DỌN DẸP (xoá namespace getshopy-demo, getshopy-bg + metrics-server)'
            Step-Teardown
        }
    }
} finally {
    # Bước bị ngắt (Ctrl+C / lỗi) giữa lúc vòng request đang chạy: dừng job nền của script này.
    foreach ($j in @($LoopJobs)) { Remove-Job -Job $j -Force -ErrorAction SilentlyContinue }
    try { [Console]::OutputEncoding = $prevConsoleEncoding } catch { }
}
