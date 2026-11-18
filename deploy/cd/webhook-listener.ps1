<#
.SYNOPSIS
    Nhận yêu cầu deploy đã ký HMAC từ GitHub Actions và chạy pull-deploy.ps1 — mỗi lúc một bản.

.DESCRIPTION
    HttpListener chỉ nghe http://127.0.0.1:<Port>/hooks/ (loopback). Đường vào duy nhất từ
    Internet là Tailscale Funnel gắn path /hooks vào cổng này (README). Không phải container,
    không chạm docker socket từ phía Internet: listener chỉ kiểm tra dữ liệu rồi gọi
    pull-deploy.ps1 với tham số ĐÃ kiểm (kind, tag, sha, pr) — không chạy gì lấy từ body.

      POST /hooks/deploy              body JSON {kind:"build_prod", tag:"sha-<sha>", sha, ref:"refs/heads/build_prod", timestamp, nonce}
                                      header X-Hub-Signature-256: sha256=<HMAC-SHA256(secret, body thô)>
                                      -> 202 {id, status_url}
      GET  /hooks/deploy/status/<id>  id = 32 ký tự hex ngẫu nhiên (không đoán được) -> trạng thái job
      GET  /hooks/health              -> 200 {ok, busy}   (kiểm tra đường Funnel)

    Kiểm tra theo thứ tự: kích thước body -> chữ ký (so sánh thời gian hằng) -> JSON chỉ gồm đúng
    các trường cho phép -> timestamp lệch <= MaxSkewSec -> nonce chưa dùng (lưu ra đĩa, sống qua
    khởi động lại) -> kind/tag/sha/ref/pr đúng dạng và khớp nhau.

    Hàng đợi: một job chạy, tối đa một job chờ; yêu cầu mới hơn THAY job đang chờ (superseded).

    Secret: %LOCALAPPDATA%\getshopy-cd\webhook.secret (>= 32 ký tự), cùng giá trị với secret
    DEPLOY_WEBHOOK_SECRET của environment "production" trên GitHub.
    Log: %LOCALAPPDATA%\getshopy-cd\listener.log ; job: ...\jobs\<id>.json

.EXAMPLE
    .\webhook-listener.ps1                                  # chạy thật (register-task.ps1 gọi)
    .\webhook-listener.ps1 -Port 9900 -DryRun -StateDir $env:TEMP\cd-test -RepoDir D:\clone
#>
[CmdletBinding()]
param(
    [int]$Port = 18095,
    [string]$PathPrefix = '/hooks',
    [string]$StateDir = (Join-Path $env:LOCALAPPDATA 'getshopy-cd'),
    [string]$SecretFile = '',
    [string]$RepoDir = 'C:\Users\AD\Desktop\TDTU 2023-2024\KLTN\ktln-Getshopy',
    [string]$Branch = 'build_prod',
    [int]$MaxSkewSec = 300,
    [int]$MaxBodyBytes = 8192,
    [int]$JobRetentionDays = 7,
    [switch]$DryRun
)

Set-StrictMode -Version 2.0
$ErrorActionPreference = 'Stop'

if (-not $SecretFile) { $SecretFile = Join-Path $StateDir 'webhook.secret' }
$Executor = Join-Path $PSScriptRoot 'pull-deploy.ps1'
$JobsDir = Join-Path $StateDir 'jobs'
$LogFile = Join-Path $StateDir 'listener.log'
$NonceFile = Join-Path $StateDir 'nonces.json'
$Utf8 = New-Object System.Text.UTF8Encoding $false
$AllowedFields = @('kind', 'tag', 'sha', 'ref', 'timestamp', 'nonce')
$Terminal = @('succeeded', 'failed', 'rejected', 'rolled_back', 'rollback_failed', 'superseded')

$script:Queued = $null      # id của job đang chờ
$script:Running = $null     # @{ Id; Process }
$script:Nonces = @{}        # nonce -> epoch giây

function Write-Log([string]$Level, [string]$Message) {
    $line = '{0} [{1}] {2}' -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $Level, $Message
    Write-Host $line
    try {
        if ((Test-Path $LogFile) -and ((Get-Item $LogFile).Length -gt 5MB)) { Move-Item $LogFile "$LogFile.1" -Force }
        [IO.File]::AppendAllText($LogFile, $line + "`r`n", $Utf8)
    } catch { }
}

function Get-Epoch { return [long]([DateTimeOffset]::UtcNow.ToUnixTimeSeconds()) }

function Get-JobPath([string]$Id) { return Join-Path $JobsDir "$Id.json" }

function Read-Job([string]$Id) {
    $p = Get-JobPath $Id
    if (-not (Test-Path $p)) { return $null }
    for ($i = 0; $i -lt 3; $i++) {
        try { return ([IO.File]::ReadAllText($p, $Utf8) | ConvertFrom-Json) } catch { Start-Sleep -Milliseconds 100 }
    }
    return $null
}

function Write-Job([string]$Id, [hashtable]$Data) {
    $p = Get-JobPath $Id
    $tmp = "$p.$PID.tmp"
    [IO.File]::WriteAllText($tmp, ($Data | ConvertTo-Json -Depth 4), $Utf8)
    for ($i = 0; $i -lt 5; $i++) {
        try { Move-Item $tmp $p -Force; return } catch { Start-Sleep -Milliseconds 100 }
    }
}

function Update-Job([string]$Id, [string]$Status, [string]$Message) {
    $j = Read-Job $Id
    if (-not $j) { return }
    $h = @{}
    foreach ($prop in $j.PSObject.Properties) { $h[$prop.Name] = $prop.Value }
    $h['status'] = $Status
    if ($Message) { $h['message'] = $Message }
    if ($Terminal -contains $Status) { $h['finished_at'] = (Get-Date).ToString('o') }
    Write-Job $Id $h
}

function New-JobId {
    $b = New-Object byte[] 16
    $rng = [Security.Cryptography.RandomNumberGenerator]::Create()
    try { $rng.GetBytes($b) } finally { $rng.Dispose() }
    return (-join ($b | ForEach-Object { $_.ToString('x2') }))
}

# ─── Xác thực ────────────────────────────────────────────────────────────────

function Get-HmacHex([byte[]]$Key, [byte[]]$Data) {
    $h = New-Object System.Security.Cryptography.HMACSHA256 -ArgumentList (, $Key)
    try { return (-join ($h.ComputeHash($Data) | ForEach-Object { $_.ToString('x2') })) } finally { $h.Dispose() }
}

# So sánh thời gian hằng: không lộ chữ ký đúng qua thời gian phản hồi
function Test-SameString([string]$A, [string]$B) {
    if ($A.Length -ne $B.Length) { return $false }
    $diff = 0
    for ($i = 0; $i -lt $A.Length; $i++) { $diff = $diff -bor ([int][char]$A[$i] -bxor [int][char]$B[$i]) }
    return ($diff -eq 0)
}

function Import-Nonces {
    if (Test-Path $NonceFile) {
        try {
            $o = [IO.File]::ReadAllText($NonceFile, $Utf8) | ConvertFrom-Json
            foreach ($p in $o.PSObject.Properties) { $script:Nonces[$p.Name] = [long]$p.Value }
        } catch { Write-Log 'WARN' 'nonces.json hỏng — bắt đầu lại danh sách nonce' }
    }
}

function Save-Nonces {
    $cut = (Get-Epoch) - (2 * $MaxSkewSec)
    foreach ($k in @($script:Nonces.Keys)) { if ($script:Nonces[$k] -lt $cut) { $script:Nonces.Remove($k) } }
    $tmp = "$NonceFile.tmp"
    [IO.File]::WriteAllText($tmp, ($script:Nonces | ConvertTo-Json -Depth 2), $Utf8)
    Move-Item $tmp $NonceFile -Force
}

# Trả về @{ Ok; Code; Error; Req } — Req là dữ liệu đã kiểm, dùng được.
function Test-DeployRequest([byte[]]$Body, [string]$Signature) {
    $fail = { param($c, $e) return @{ Ok = $false; Code = $c; Error = $e; Req = $null } }

    if ($Signature -notmatch '^sha256=([0-9a-f]{64})$') { return (& $fail 401 'thiếu hoặc sai dạng X-Hub-Signature-256') }
    $given = $Matches[1]
    $expected = Get-HmacHex $script:SecretBytes $Body
    if (-not (Test-SameString $expected $given)) { return (& $fail 401 'chữ ký không khớp') }

    try { $o = $Utf8.GetString($Body) | ConvertFrom-Json } catch { return (& $fail 400 'body không phải JSON') }
    if ($null -eq $o -or $o -isnot [pscustomobject]) { return (& $fail 400 'body phải là object JSON') }
    $names = @($o.PSObject.Properties | ForEach-Object { $_.Name })
    $extra = @($names | Where-Object { $AllowedFields -notcontains $_ })
    if ($extra.Count -gt 0) { return (& $fail 400 "trường không cho phép: $($extra -join ', ')") }
    foreach ($f in $AllowedFields) { if ($names -notcontains $f) { return (& $fail 400 "thiếu trường $f") } }

    $ts = 0L
    if (-not [long]::TryParse("$($o.timestamp)", [ref]$ts)) { return (& $fail 400 'timestamp phải là số giây epoch') }
    if ([math]::Abs((Get-Epoch) - $ts) -gt $MaxSkewSec) { return (& $fail 401 "timestamp lệch quá $MaxSkewSec s (hết hạn hoặc đồng hồ sai)") }

    $nonce = "$($o.nonce)"
    if ($nonce -notmatch '^[A-Za-z0-9_-]{16,128}$') { return (& $fail 400 'nonce sai dạng') }
    if ($script:Nonces.ContainsKey($nonce)) { return (& $fail 409 'nonce đã dùng (gửi lại yêu cầu cũ)') }

    $kind = "$($o.kind)"; $tag = "$($o.tag)"; $sha = "$($o.sha)"; $ref = "$($o.ref)"
    if ($kind -ne 'build_prod') { return (& $fail 400 'kind phải là build_prod') }
    if ($tag -notmatch '^sha-[0-9a-f]{7,40}$') { return (& $fail 400 'tag sai dạng (sha-<hex>)') }
    if ($sha -notmatch '^[0-9a-f]{40}$') { return (& $fail 400 'sha phải đủ 40 ký tự hex') }
    if ($tag -ne "sha-$sha") { return (& $fail 400 'tag phải là sha-<sha>') }
    if ($ref -ne "refs/heads/$Branch") { return (& $fail 400 "ref phải là refs/heads/$Branch") }

    # Chỉ ghi nhận nonce khi MỌI kiểm tra đã qua
    $script:Nonces[$nonce] = $ts
    Save-Nonces
    return @{ Ok = $true; Code = 202; Error = ''; Req = @{ kind = $kind; tag = $tag; sha = $sha; ref = $ref } }
}

# ─── HTTP ────────────────────────────────────────────────────────────────────

function Send-Json($Ctx, [int]$Code, $Object) {
    $bytes = $Utf8.GetBytes(($Object | ConvertTo-Json -Depth 4 -Compress))
    $res = $Ctx.Response
    $res.StatusCode = $Code
    $res.ContentType = 'application/json; charset=utf-8'
    $res.Headers['Cache-Control'] = 'no-store'
    $res.ContentLength64 = $bytes.Length
    try { $res.OutputStream.Write($bytes, 0, $bytes.Length) } finally { $res.Close() }
}

function Read-Body($Req) {
    $len = [int]$Req.ContentLength64
    $buf = New-Object byte[] $len
    $read = 0
    while ($read -lt $len) {
        $n = $Req.InputStream.Read($buf, $read, $len - $read)
        if ($n -le 0) { break }
        $read += $n
    }
    if ($read -ne $len) { throw 'body bị cắt' }
    return , $buf
}

function Invoke-Request($Ctx) {
    $req = $Ctx.Request
    $path = $req.Url.AbsolutePath
    $method = $req.HttpMethod
    # Tailscale Funnel ghi IP thật của khách vào X-Forwarded-For
    $from = $req.Headers['X-Forwarded-For']
    if (-not $from) { $from = "$($req.RemoteEndPoint)" }

    if ($path -eq "$PathPrefix/health") {
        if ($method -ne 'GET') { Send-Json $Ctx 405 @{ error = 'method' }; return }
        Send-Json $Ctx 200 @{ ok = $true; busy = ($null -ne $script:Running); dry_run = [bool]$DryRun }
        return
    }

    if ($path -match "^$([regex]::Escape($PathPrefix))/deploy/status/([0-9a-f]{32})$") {
        if ($method -ne 'GET') { Send-Json $Ctx 405 @{ error = 'method' }; return }
        $j = Read-Job $Matches[1]
        if (-not $j) { Send-Json $Ctx 404 @{ error = 'không có job này' }; return }
        $out = [ordered]@{}
        $have = @($j.PSObject.Properties | ForEach-Object { $_.Name })
        foreach ($k in 'id', 'status', 'kind', 'tag', 'message', 'created_at', 'started_at', 'finished_at', 'dry_run') {
            if ($have -contains $k) { $out[$k] = $j.$k }
        }
        Send-Json $Ctx 200 $out
        return
    }

    if ($path -eq "$PathPrefix/deploy") {
        if ($method -ne 'POST') { Send-Json $Ctx 405 @{ error = 'method' }; return }
        if ($req.ContentLength64 -le 0) { Send-Json $Ctx 411 @{ error = 'cần Content-Length' }; return }
        if ($req.ContentLength64 -gt $MaxBodyBytes) { Send-Json $Ctx 413 @{ error = 'body quá lớn' }; return }
        $body = Read-Body $req
        $v = Test-DeployRequest $body "$($req.Headers['X-Hub-Signature-256'])"
        if (-not $v.Ok) {
            Write-Log 'WARN' "Từ chối POST deploy từ $from`: $($v.Code) $($v.Error)"
            Send-Json $Ctx $v.Code @{ error = $v.Error }
            return
        }
        $r = $v.Req
        $id = New-JobId
        Write-Job $id @{
            id = $id; status = 'queued'; kind = $r.kind; tag = $r.tag; sha = $r.sha; ref = $r.ref
            created_at = (Get-Date).ToString('o'); message = 'Đang chờ tới lượt'
        }
        if ($script:Queued) {
            Update-Job $script:Queued 'superseded' "Bị thay bởi yêu cầu mới hơn ($($r.tag))"
            Write-Log 'INFO' "Job $($script:Queued.Substring(0, 8)) bị thay bởi $($id.Substring(0, 8))"
        }
        $script:Queued = $id
        Write-Log 'INFO' "Nhận deploy $($r.kind) $($r.tag) từ $from -> job $($id.Substring(0, 8))"
        Send-Json $Ctx 202 @{ id = $id; status = 'queued'; status_url = "$PathPrefix/deploy/status/$id" }
        return
    }

    Send-Json $Ctx 404 @{ error = 'không có' }
}

# ─── Hàng đợi ────────────────────────────────────────────────────────────────

function Quote-Arg([string]$s) { return '"' + $s + '"' }

function Invoke-Housekeeping {
    if ($script:Running -and $script:Running.Process.HasExited) {
        $id = $script:Running.Id
        $code = $script:Running.Process.ExitCode
        $j = Read-Job $id
        if ($j -and ($Terminal -notcontains "$($j.status)")) {
            Update-Job $id 'failed' "Bộ deploy dừng bất thường (mã $code), xem deploy.log"
        }
        $final = '?'
        $j = Read-Job $id
        if ($j) { $final = "$($j.status)" }
        Write-Log 'INFO' "Job $($id.Substring(0, 8)) kết thúc: $final (mã $code)"
        $script:Running = $null
    }
    if (-not $script:Running -and $script:Queued) {
        $id = $script:Queued
        $script:Queued = $null
        $j = Read-Job $id
        if (-not $j) { return }
        # Mọi giá trị dưới đây đã qua kiểm tra regex ở Test-DeployRequest
        $argList = @(
            '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass',
            '-File', (Quote-Arg $Executor),
            '-Kind', "$($j.kind)", '-Tag', "$($j.tag)", '-Sha', "$($j.sha)",
            '-JobFile', (Quote-Arg (Get-JobPath $id)),
            '-RepoDir', (Quote-Arg $RepoDir), '-Branch', $Branch,
            '-StateDir', (Quote-Arg $StateDir)
        )
        if ($DryRun) { $argList += '-DryRun' }
        Update-Job $id 'running' 'Đang deploy'
        $p = Start-Process -FilePath 'powershell.exe' -ArgumentList ($argList -join ' ') -NoNewWindow -PassThru
        $null = $p.Handle   # giữ handle để đọc được ExitCode sau khi tiến trình kết thúc (PS 5.1)
        $script:Running = @{ Id = $id; Process = $p }
        Write-Log 'INFO' "Bắt đầu job $($id.Substring(0, 8)): $($j.kind) $($j.tag) (pid $($p.Id))"
    }
}

function Remove-OldJobs {
    $cut = (Get-Date).AddDays(-$JobRetentionDays)
    Get-ChildItem -Path $JobsDir -Filter '*.json' -ErrorAction SilentlyContinue |
        Where-Object { $_.LastWriteTime -lt $cut } | Remove-Item -Force -ErrorAction SilentlyContinue
}

# ─── Khởi động ───────────────────────────────────────────────────────────────

New-Item -ItemType Directory -Force -Path $StateDir, $JobsDir | Out-Null
if (-not (Test-Path $SecretFile)) {
    Write-Log 'ERROR' "Chưa có secret $SecretFile — tạo theo README (mục Cài đặt) rồi chạy lại."
    exit 1
}
$secret = ([IO.File]::ReadAllText($SecretFile)).Trim()
if ($secret.Length -lt 32) {
    Write-Log 'ERROR' 'Secret quá ngắn (< 32 ký tự) — tạo lại theo README.'
    exit 1
}
$script:SecretBytes = $Utf8.GetBytes($secret)
Remove-Variable secret
if (-not (Test-Path $Executor)) { Write-Log 'ERROR' "Thiếu $Executor"; exit 1 }
Import-Nonces

# Job bị bỏ dở do listener chết giữa chừng thì đánh dấu, để Actions không chờ mãi
Get-ChildItem -Path $JobsDir -Filter '*.json' -ErrorAction SilentlyContinue | ForEach-Object {
    $id = $_.BaseName
    $j = Read-Job $id
    if ($j -and ($Terminal -notcontains "$($j.status)")) { Update-Job $id 'failed' 'Listener khởi động lại giữa chừng — gửi lại yêu cầu' }
}
Remove-OldJobs

$prefix = "http://127.0.0.1:$Port$PathPrefix/"
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add($prefix)
try {
    $listener.Start()
} catch {
    # Cùng prefix đã có listener khác giữ (một bản đang chạy) hoặc cổng bận
    Write-Log 'ERROR' "Không mở được $prefix`: $($_.Exception.Message)"
    exit 1
}
$mode = ''
if ($DryRun) { $mode = ' [DRY-RUN: pull-deploy chạy -DryRun]' }
Write-Log 'INFO' "Listener nghe $prefix (repo: $RepoDir, nhánh: $Branch)$mode"

$lastCleanup = Get-Date
try {
    while ($listener.IsListening) {
        $ar = $listener.BeginGetContext($null, $null)
        while (-not $ar.AsyncWaitHandle.WaitOne(1000)) {
            Invoke-Housekeeping
            if (((Get-Date) - $lastCleanup).TotalHours -ge 6) { Remove-OldJobs; $lastCleanup = Get-Date }
        }
        $ctx = $listener.EndGetContext($ar)
        try {
            Invoke-Request $ctx
        } catch {
            Write-Log 'ERROR' "Xử lý request lỗi: $($_.Exception.Message)"
            try { Send-Json $ctx 500 @{ error = 'lỗi nội bộ' } } catch { }
        }
        Invoke-Housekeeping
    }
} finally {
    $listener.Close()
    Write-Log 'INFO' 'Listener dừng.'
}
