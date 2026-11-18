<#
.SYNOPSIS
    Bộ thực thi deploy của Getshopy trên máy production: kéo image đã build sẵn trên GHCR rồi
    cập nhật 4 service ứng dụng (client, server, ai-bot, ai-rec). KHÔNG build gì tại máy.

.DESCRIPTION
    Ba chế độ:

      -Tag sha-<40 ký tự>
          Deploy đúng một bản. webhook-listener.ps1 gọi chế độ này cho mỗi yêu cầu đã xác thực
          từ GitHub Actions (kèm -JobFile để báo trạng thái); gõ tay cũng được. Commit phải thuộc
          lịch sử origin/build_prod. Mới hơn checkout -> git merge --ff-only; cũ hơn (quay về)
          -> chỉ đổi image, checkout giữ nguyên.

      -Poll   (dự phòng, mặc định TẮT) — tự hỏi: git fetch build_prod; commit mới mà CI trên
              GitHub đã xanh và đã có đủ 4 image sha-<commit> -> deploy như trên.

      -Rollback — quay tay về bản trước ghi trong state, đánh dấu bản hiện tại là lỗi.

    Mỗi lần deploy: ổ Docker còn >= MinFreeGB; đủ 4 image trên GHCR (docker manifest inspect);
    docker pull trước khi đụng bất cứ gì; ghi nhớ image đang chạy thành tag :rollback;
    docker compose up -d --no-build --no-deps server ai-bot ai-rec (chờ healthy) rồi client;
    kiểm tra <HealthBaseUrl>/api/health và / cùng trả 200. Lỗi -> rollback về :rollback (và
    git reset --keep nếu đã dời checkout). Xong -> ghi state, gắn :local, xoá tag cũ.

    KHÔNG đụng: .env, hạ tầng (postgres, clickhouse, redis, kafka, minio, gateway...).

    Log:   %LOCALAPPDATA%\getshopy-cd\deploy.log      State: ...\state.json

.PARAMETER DryRun
    In mọi lệnh làm thay đổi (git merge/reset, docker pull/tag/rmi/compose up/ps) thay vì chạy.
    Chỉ chạy lệnh đọc: git fetch/rev-parse/diff, GitHub API, docker manifest inspect,
    docker compose config. Kiểm tra chặn chỉ được BÁO, không dừng. Không ghi state.

.EXAMPLE
    .\pull-deploy.ps1 -Tag sha-<40 ký tự>     # deploy (hoặc quay về) một commit của build_prod
    .\pull-deploy.ps1 -Rollback              # quay về bản trước
    .\pull-deploy.ps1 -Poll -DryRun          # xem chế độ hỏi định kỳ sẽ làm gì
#>
[CmdletBinding()]
param(
    [ValidateSet('build_prod')]
    [string]$Kind = 'build_prod',
    [string]$Tag = '',
    [string]$Sha = '',
    [string]$JobFile = '',
    [switch]$Poll,
    [switch]$Rollback,
    [switch]$DryRun,
    [switch]$Force,
    [string]$RepoDir = 'C:\Users\AD\Desktop\TDTU 2023-2024\KLTN\ktln-Getshopy',
    [string]$Branch = 'build_prod',
    [string]$Remote = 'origin',
    [string]$GitHubRepo = 'LeVanTrieuAn/ktln-Getshopy',
    [string]$CiWorkflow = 'ci.yml',
    [string]$ImagePrefix = 'ghcr.io/levantrieuan/ktln-getshopy',
    # Cổng loopback của gateway (GATEWAY_SERVE_PORT, mặc định 18000)
    [string]$HealthBaseUrl = 'http://127.0.0.1:18000',
    [int]$HealthTimeoutSec = 120,
    # Chờ healthcheck của compose (server: start_period 30 s + 12 lần x 10 s)
    [int]$ComposeWaitSec = 300,
    # Ổ chứa ổ đĩa ảo của Docker Desktop
    [string]$DockerDrive = 'D',
    [int]$MinFreeGB = 20,
    [string]$StateDir = (Join-Path $env:LOCALAPPDATA 'getshopy-cd')
)

Set-StrictMode -Version 2.0
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
[Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12
try { [Console]::OutputEncoding = [Text.Encoding]::UTF8 } catch { }

# Thứ tự có ý nghĩa: client lên SAU server (nginx của client phân giải tên server lúc khởi động)
$Services = @('server', 'ai-bot', 'ai-rec', 'client')
$Backend = @('server', 'ai-bot', 'ai-rec')
$TagPattern = '^sha-[0-9a-f]{7,40}$'
$script:HealthOk = $false
$script:RollbackOk = $false
$Utf8 = New-Object System.Text.UTF8Encoding $false
$LogFile = Join-Path $StateDir 'deploy.log'
$StateFile = Join-Path $StateDir 'state.json'
$LockFile = Join-Path $StateDir 'deploy.lock'
$ComposeFile = Join-Path $RepoDir 'docker-compose.yml'

# Deploy CHỈ THAY CODE, KHÔNG ĐỤNG DB (người dùng yêu cầu 19/11/2026). Mọi lệnh docker compose
# của script (kể cả rollback) chạy với SERVER_DB_PREP=off -> container server mới bỏ qua migrate,
# SQL tồn kho, seed (docker-entrypoint.sh, DB_PREP). Migration là bước làm tay: bản cần
# migration chưa áp thì CHẶN deploy (Get-PendingMigrations — chỉ ĐỌC _prisma_migrations).
$env:SERVER_DB_PREP = 'off'
$MigrationsPath = 'ktln-Getshopy/qu-n-ly-ban-l/source/server/prisma/migrations'
$MigrationNamePattern = '^\d{14}_[A-Za-z0-9_-]+$'

# Thay đổi ở đây agent KHÔNG tự áp (chỉ cập nhật 4 service ứng dụng) -> cảnh báo làm tay
$ManualPaths = [ordered]@{
    '^docker-compose[^/]*\.ya?ml$'                          = 'compose: service ứng dụng tự áp; service hạ tầng/gateway thì chạy tay  docker compose up -d <service>'
    '^gateway/'                                             = 'gateway: docker compose up -d --force-recreate gateway  (file mount đơn lẻ không tự cập nhật)'
    '^local-infra-sandbox/'                                 = 'hạ tầng BigData: build/khởi động lại service liên quan bằng tay'
    '^scripts/'                                             = 'scripts hạ tầng (bootstrap, dbt, etl, ch-optimize): xem service dùng script đó'
    '^data-platform-poc/'                                   = 'seed-data: docker compose --profile seed build seed-data (khi cần)'
    '^ktln-Getshopy/qu-n-ly-ban-l/source/clickhouse-init/'  = 'clickhouse-init chỉ chạy khi volume ClickHouse còn trống — áp tay nếu cần'
    '^\.env\.example$'                                      = '.env.example đổi: so với .env production, thêm biến mới bằng tay'
}
$InfoPaths = [ordered]@{
    '^ktln-Getshopy/qu-n-ly-ban-l/source/server/prisma/migrations/' = 'migration mới: server tự áp khi khởi động; rollback image KHÔNG hoàn tác schema'
    '^deploy/cd/'                                                   = 'bộ deploy đổi: listener đọc bản mới khi khởi động lại (register-task.ps1 -RunNow)'
}

# ─── Tiện ích ────────────────────────────────────────────────────────────────

function Write-Log([string]$Level, [string]$Message) {
    $prefix = ''
    if ($DryRun) { $prefix = '[DRY-RUN] ' }
    $line = '{0} [{1}] {2}{3}' -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $Level, $prefix, $Message
    Write-Host $line
    try {
        if ((Test-Path $LogFile) -and ((Get-Item $LogFile).Length -gt 5MB)) {
            Move-Item -Path $LogFile -Destination "$LogFile.1" -Force
        }
        [IO.File]::AppendAllText($LogFile, $line + "`r`n", $Utf8)
    } catch { }
}

function Write-JsonFile([string]$Path, $Object) {
    $tmp = "$Path.$PID.tmp"
    [IO.File]::WriteAllText($tmp, ($Object | ConvertTo-Json -Depth 5), $Utf8)
    for ($i = 0; $i -lt 5; $i++) {
        try { Move-Item -Path $tmp -Destination $Path -Force; return } catch { Start-Sleep -Milliseconds 200 }
    }
    Remove-Item $tmp -ErrorAction SilentlyContinue
}

function Read-JsonFile([string]$Path) {
    $h = @{}
    if (Test-Path $Path) {
        try {
            $obj = [IO.File]::ReadAllText($Path, $Utf8) | ConvertFrom-Json
            foreach ($p in $obj.PSObject.Properties) { $h[$p.Name] = $p.Value }
        } catch {
            Write-Log 'WARN' "$Path đọc không được, coi như trống: $($_.Exception.Message)"
        }
    }
    return $h
}

function Save-State([hashtable]$S) {
    if ($DryRun) { return }
    $S['updated_at'] = (Get-Date).ToString('o')
    Write-JsonFile $StateFile $S
}

function Get-Val([hashtable]$S, [string]$Key) {
    if ($S.ContainsKey($Key) -and $null -ne $S[$Key] -and "$($S[$Key])" -ne '') { return "$($S[$Key])" }
    return ''
}

# Trạng thái job cho webhook-listener (GitHub Actions hỏi qua /hooks/deploy/status/<id>).
# Thông điệp do script tự soạn, không chép nguyên đầu ra lệnh: log của repo public ai cũng đọc được.
function Set-Job([string]$Status, [string]$Message) {
    if (-not $JobFile) { return }
    $job = Read-JsonFile $JobFile
    $job['status'] = $Status
    if ($Message) { $job['message'] = $Message }
    if ($Status -eq 'running' -and -not (Get-Val $job 'started_at')) { $job['started_at'] = (Get-Date).ToString('o') }
    if ($Status -notin @('running', 'queued')) { $job['finished_at'] = (Get-Date).ToString('o') }
    if ($DryRun) { $job['dry_run'] = $true }
    Write-JsonFile $JobFile $job
}

# Tình huống lặp lại mỗi lượt (chế độ -Poll: chờ CI, mạng lỗi...) chỉ ghi log MỘT lần.
function Write-Notice([hashtable]$S, [string]$Key, [string]$Level, [string]$Message) {
    if ($DryRun -or (Get-Val $S 'notice') -ne $Key) {
        Write-Log $Level $Message
        $S['notice'] = $Key
    }
}

function Format-Command([string]$Exe, [string[]]$Arguments) {
    $parts = foreach ($a in $Arguments) { if ($a -match '\s') { '"' + $a + '"' } else { $a } }
    return "$Exe $($parts -join ' ')"
}

# Chạy lệnh ngoài, gom stdout+stderr thành chuỗi. PowerShell 5.1 biến dòng stderr của lệnh
# ngoài thành lỗi khi ErrorActionPreference = Stop (git fetch in tiến độ ra stderr), nên hạ
# xuống Continue trong lúc chạy và chỉ dựa vào mã thoát.
function Invoke-Exe {
    param(
        [Parameter(Mandatory = $true)][string]$Exe,
        [string[]]$Arguments = @(),
        [switch]$Mutating,
        [switch]$Quiet
    )
    $display = Format-Command $Exe $Arguments
    if ($Mutating -and $DryRun) {
        Write-Log 'PLAN' $display
        return [pscustomobject]@{ ExitCode = 0; Output = ''; Command = $display }
    }
    if (-not $Quiet) { Write-Log 'RUN' $display }
    $prev = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try {
        $out = & $Exe @Arguments 2>&1 | ForEach-Object { "$_" }
        $code = $LASTEXITCODE
    } finally {
        $ErrorActionPreference = $prev
    }
    $text = (@($out) -join "`n").Trim()
    if ($code -ne 0 -and -not $Quiet) { Write-Log 'WARN' "  -> mã thoát $code`: $text" }
    return [pscustomobject]@{ ExitCode = $code; Output = $text; Command = $display }
}

function Invoke-Git([string[]]$GitArgs, [switch]$Mutating, [switch]$Quiet) {
    Invoke-Exe -Exe 'git' -Arguments (@('-C', $RepoDir, '-c', 'core.quotePath=false') + $GitArgs) -Mutating:$Mutating -Quiet:$Quiet
}

function Invoke-Compose([string[]]$ComposeArgs, [switch]$Mutating, [switch]$Quiet) {
    Invoke-Exe -Exe 'docker' -Arguments (@('compose', '--project-directory', $RepoDir, '-f', $ComposeFile) + $ComposeArgs) -Mutating:$Mutating -Quiet:$Quiet
}

function Get-ImageRef([string]$Service, [string]$ImageTag) { return "$ImagePrefix-${Service}:$ImageTag" }

# Migration có trong commit $Sha mà Postgres CHƯA áp xong. Chỉ đọc: git ls-tree + SELECT trên
# _prisma_migrations qua psql trong container postgres. Trả $null nếu không đọc được (-> chặn).
# Chuỗi lệnh sh không chứa dấu nháy kép: PowerShell 5.1 truyền nháy kép cho lệnh ngoài sai.
function Get-PendingMigrations([string]$Sha) {
    $ls = Invoke-Git -Quiet -GitArgs @('ls-tree', '--name-only', "${Sha}:$MigrationsPath")
    if ($ls.ExitCode -ne 0) { return $null }
    $wanted = @($ls.Output -split "`n" | ForEach-Object { $_.Trim() } | Where-Object { $_ -match $MigrationNamePattern })
    $sql = 'select migration_name from _prisma_migrations where finished_at is not null and rolled_back_at is null'
    $q = Invoke-Compose -Quiet -ComposeArgs @('exec', '-T', 'postgres', 'sh', '-c', "psql -q -U `$POSTGRES_USER -d `$POSTGRES_DB -tAc '$sql'")
    if ($q.ExitCode -ne 0) { return $null }
    $applied = @($q.Output -split "`n" | ForEach-Object { $_.Trim() } | Where-Object { $_ -match $MigrationNamePattern })
    if ($applied.Count -eq 0) { return $null }   # bảng rỗng / đọc sai -> không đoán, chặn
    # Dấu phẩy: giữ mảng RỖNG là mảng (không có nó PowerShell trả $null = "không đọc được")
    return , @($wanted | Where-Object { $applied -notcontains $_ })
}

function Short([string]$Value) {
    if ($Value -match '^sha-([0-9a-f]{7})') { return "sha-$($Matches[1])" }
    if ($Value.Length -ge 7) { return $Value.Substring(0, 7) }
    return $Value
}

function Get-FetchedTip {
    $f = Invoke-Git -Quiet -GitArgs @('fetch', '--quiet', '--no-tags', $Remote, "+refs/heads/${Branch}:refs/remotes/$Remote/$Branch")
    if ($f.ExitCode -ne 0) { return '' }
    return (Invoke-Git -Quiet -GitArgs @('rev-parse', "refs/remotes/$Remote/$Branch")).Output
}

# ─── Cổng: CI trên GitHub (chỉ chế độ -Poll) + image trên GHCR ──────────────

function Get-CiStatus([string]$CommitSha) {
    # Hỏi /actions/runs của cả repo rồi lọc theo path: endpoint /workflows/ci.yml/runs có thể
    # trả 404 khi ci.yml mới nằm trên build_prod mà chưa có trên nhánh mặc định (main).
    # Chưa đăng nhập GitHub: 60 request/giờ/IP.
    $uri = "https://api.github.com/repos/$GitHubRepo/actions/runs?head_sha=$CommitSha&per_page=50"
    $headers = @{
        'Accept'               = 'application/vnd.github+json'
        'User-Agent'           = 'getshopy-cd'
        'X-GitHub-Api-Version' = '2022-11-28'
    }
    $token = $env:GETSHOPY_CD_GITHUB_TOKEN
    if (-not $token) { $token = $env:GITHUB_TOKEN }
    if ($token) { $headers['Authorization'] = "Bearer $token" }
    try {
        $resp = Invoke-RestMethod -Uri $uri -Headers $headers -TimeoutSec 20 -UseBasicParsing
    } catch {
        return [pscustomobject]@{ Status = 'unknown'; Detail = "GitHub API lỗi: $($_.Exception.Message)" }
    }
    $runs = @($resp.workflow_runs | Where-Object {
            $_.path -like ".github/workflows/$CiWorkflow*" -and $_.head_branch -eq $Branch -and
            ($_.event -eq 'push' -or $_.event -eq 'workflow_dispatch')
        })
    if ($runs.Count -eq 0) {
        return [pscustomobject]@{ Status = 'pending'; Detail = 'chưa có lần chạy CI nào cho commit này' }
    }
    $ok = @($runs | Where-Object { $_.status -eq 'completed' -and $_.conclusion -eq 'success' })
    if ($ok.Count -gt 0) {
        return [pscustomobject]@{ Status = 'success'; Detail = $ok[0].html_url }
    }
    $latest = $runs | Sort-Object -Property created_at -Descending | Select-Object -First 1
    if ($latest.status -ne 'completed') {
        return [pscustomobject]@{ Status = 'pending'; Detail = "CI đang $($latest.status): $($latest.html_url)" }
    }
    return [pscustomobject]@{ Status = 'failure'; Detail = "CI kết thúc '$($latest.conclusion)': $($latest.html_url)" }
}

function Get-MissingImages([string]$ImageTag) {
    $missing = @()
    foreach ($svc in $Services) {
        $r = Invoke-Exe -Exe 'docker' -Arguments @('manifest', 'inspect', (Get-ImageRef $svc $ImageTag)) -Quiet
        if ($r.ExitCode -ne 0) { $missing += $svc }
    }
    return , $missing
}

# ─── Sức khoẻ / khởi động / rollback / dọn image ─────────────────────────────

function Test-Url([string]$Url) {
    try {
        $r = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 5
        return [pscustomobject]@{ Ok = ($r.StatusCode -eq 200); Code = "$($r.StatusCode)" }
    } catch {
        $code = 'không trả lời'
        try { if ($_.Exception.Response) { $code = "$([int]$_.Exception.Response.StatusCode)" } } catch { }
        return [pscustomobject]@{ Ok = $false; Code = $code }
    }
}

# Trả về chuỗi tóm tắt; $script:HealthOk cho biết đạt hay không.
function Wait-Healthy {
    if ($DryRun) {
        Write-Log 'PLAN' "health check: $HealthBaseUrl/api/health và $HealthBaseUrl/ cùng trả 200 trong $HealthTimeoutSec s"
        $script:HealthOk = $true
        return 'health check bỏ qua (dry-run)'
    }
    $start = Get-Date
    $deadline = $start.AddSeconds($HealthTimeoutSec)
    $summary = ''
    while ((Get-Date) -lt $deadline) {
        $api = Test-Url "$HealthBaseUrl/api/health"
        $web = Test-Url "$HealthBaseUrl/"
        $summary = "/api/health $($api.Code), / $($web.Code)"
        if ($api.Ok -and $web.Ok) {
            $secs = [int]((Get-Date) - $start).TotalSeconds
            Write-Log 'INFO' "Health OK sau $secs s: $summary"
            $script:HealthOk = $true
            return "health OK ($summary) sau $secs s"
        }
        Start-Sleep -Seconds 5
    }
    Write-Log 'ERROR' "Health check không đạt sau $HealthTimeoutSec s: $summary"
    $script:HealthOk = $false
    return "health KHÔNG đạt sau $HealthTimeoutSec s ($summary)"
}

# Dựng lại các service theo IMAGE_TAG hiện tại: backend trước (chờ healthy), client sau.
# --no-deps: không bao giờ tạo lại postgres/clickhouse/redis dù compose của chúng đổi.
# Không --scale: server có deploy.replicas thì compose tự giữ đúng số bản sao.
function Start-AppServices([string[]]$Only) {
    $back = @($Backend | Where-Object { $Only -contains $_ })
    if ($back.Count -gt 0) {
        $r = Invoke-Compose -Mutating -ComposeArgs (@('up', '-d', '--no-build', '--no-deps', '--wait', '--wait-timeout', "$ComposeWaitSec") + $back)
        if ($r.ExitCode -ne 0) { throw "docker compose up $($back -join ', ') lỗi (xem deploy.log)" }
    }
    if ($Only -contains 'client') {
        $r = Invoke-Compose -Mutating -ComposeArgs @('up', '-d', '--no-build', '--no-deps', '--wait', '--wait-timeout', '120', 'client')
        if ($r.ExitCode -ne 0) { throw 'docker compose up client lỗi (xem deploy.log)' }
    }
}

# Gắn tag :rollback cho image của container ĐANG chạy — rollback về đúng thứ vừa chạy, kể cả
# lần đầu (image build tại máy, chưa có tag sha nào). Trả về các service đã ghi nhớ được.
function Save-RunningImages {
    $saved = @()
    foreach ($svc in $Services) {
        if ($DryRun) {
            Write-Log 'PLAN' "docker tag <image của container $svc đang chạy> $(Get-ImageRef $svc 'rollback')"
            $saved += $svc
            continue
        }
        $ids = Invoke-Compose -Quiet -ComposeArgs @('ps', '-q', $svc)
        $cid = ($ids.Output -split "`n" | Where-Object { $_ -match '^[0-9a-f]{12,}$' } | Select-Object -First 1)
        if (-not $cid) {
            Write-Log 'WARN' "$svc không có container đang chạy — rollback sẽ bỏ qua $svc"
            continue
        }
        $rbRef = Get-ImageRef $svc 'rollback'
        $oldRb = Invoke-Exe -Exe 'docker' -Arguments @('image', 'inspect', '--format', '{{.Id}}', $rbRef) -Quiet
        $img = (Invoke-Exe -Exe 'docker' -Arguments @('inspect', '--format', '{{.Image}}', $cid) -Quiet).Output
        $t = Invoke-Exe -Exe 'docker' -Arguments @('tag', $img, $rbRef) -Quiet
        if ($t.ExitCode -eq 0) { $saved += $svc } else { Write-Log 'WARN' "Không gắn được tag rollback cho $svc`: $($t.Output)" }
        # Image :rollback cũ không còn tag nào (vd. sau nhiều lần /rebuild cùng một sha) thì xoá
        if ($oldRb.ExitCode -eq 0 -and $oldRb.Output -and $oldRb.Output -ne $img) { Remove-IfUntagged $oldRb.Output }
    }
    return , $saved
}

# $ResetTo rỗng = không đụng git. Trả về chuỗi tóm tắt; $script:RollbackOk cho biết kết quả.
function Invoke-Rollback([string]$ResetTo, [string]$ImageTag, [string[]]$Only) {
    $label = $ImageTag
    if (-not $label) { $label = 'image build tại máy' }
    Write-Log 'ERROR' "===== ROLLBACK ($label): $($Only -join ', ') ====="
    $ok = $true
    if ($ResetTo) {
        # reset --keep: dời nhánh về commit cũ, chỉ sửa tệp khác nhau giữa hai commit; tệp nào
        # có thay đổi cục bộ mà phải ghi đè thì TỪ CHỐI cả lệnh — không mất gì. Không dùng --hard.
        $r = Invoke-Git -Mutating -GitArgs @('reset', '--keep', $ResetTo)
        if ($r.ExitCode -ne 0) {
            Write-Log 'ERROR' "git reset --keep thất bại — checkout vẫn ở commit mới, chỉ quay image. Xử lý tay: git -C `"$RepoDir`" status"
            $ok = $false
        }
    }
    if ($ImageTag) {
        $env:IMAGE_TAG = $ImageTag
        if (-not $DryRun) {
            foreach ($svc in $Only) {
                $ref = Get-ImageRef $svc $ImageTag
                if ((Invoke-Exe -Exe 'docker' -Arguments @('image', 'inspect', $ref) -Quiet).ExitCode -ne 0) {
                    [void](Invoke-Exe -Exe 'docker' -Arguments @('pull', '--quiet', $ref))
                }
            }
        }
    } else {
        Remove-Item Env:IMAGE_TAG -ErrorAction SilentlyContinue
    }
    $health = 'chưa kiểm tra'
    try {
        Start-AppServices -Only $Only
        $health = Wait-Healthy
        if (-not $script:HealthOk) { $ok = $false }
    } catch {
        Write-Log 'ERROR' "Rollback: $($_.Exception.Message)"
        $ok = $false
    }
    $script:RollbackOk = $ok
    if ($ok) {
        Write-Log 'ERROR' "===== ROLLBACK XONG ($label) ====="
    } else {
        Write-Log 'ERROR' '===== ROLLBACK KHÔNG TRỌN — CẦN XỬ LÝ TAY (README, mục Sự cố) ====='
    }
    return $health
}

# Giữ tag của bản hiện tại + bản trước; tag local/rollback không đụng tới.
function Remove-OldImages([string[]]$Keep) {
    foreach ($svc in $Services) {
        $repo = "$ImagePrefix-$svc"
        if ($DryRun) {
            Write-Log 'PLAN' "docker rmi các tag sha-* của $repo ngoài: $($Keep -join ', ')"
            continue
        }
        $tags = (Invoke-Exe -Exe 'docker' -Arguments @('image', 'ls', $repo, '--format', '{{.Tag}}') -Quiet).Output -split "`n"
        foreach ($t in $tags) {
            $t = $t.Trim()
            # rmi theo TAG: image còn tag khác hoặc đang có container dùng thì docker chỉ gỡ tag / từ chối
            if ($t -like 'sha-*' -and $Keep -notcontains $t) {
                [void](Invoke-Exe -Exe 'docker' -Arguments @('rmi', "${repo}:$t"))
            }
        }
    }
}

# Xoá image theo ID CHỈ khi nó không còn tag nào (docker rmi <ID> sẽ xoá cả image còn đúng
# một tag khác — vd. kltn-server:latest build tay — nên phải tự kiểm). Container còn dùng thì
# docker tự từ chối.
function Remove-IfUntagged([string]$ImageId) {
    $n = (Invoke-Exe -Exe 'docker' -Arguments @('image', 'inspect', '--format', '{{len .RepoTags}}', $ImageId) -Quiet).Output
    if ($n -eq '0') { [void](Invoke-Exe -Quiet -Exe 'docker' -Arguments @('rmi', $ImageId)) }
}

# :local = bản đang chạy, để `docker compose up -d` gõ tay không đặt IMAGE_TAG dùng nó thay vì
# tự build lại trên máy (đĩa D: chật). Image :local cũ (thường là bản build tay) hết tag thì xoá.
function Set-LocalAlias([string]$ImageTag) {
    foreach ($svc in $Services) {
        $local = Get-ImageRef $svc 'local'
        if ($DryRun) { Write-Log 'PLAN' "docker tag $(Get-ImageRef $svc $ImageTag) $local"; continue }
        $old = Invoke-Exe -Exe 'docker' -Arguments @('image', 'inspect', '--format', '{{.Id}}', $local) -Quiet
        [void](Invoke-Exe -Quiet -Exe 'docker' -Arguments @('tag', (Get-ImageRef $svc $ImageTag), $local))
        $new = (Invoke-Exe -Exe 'docker' -Arguments @('image', 'inspect', '--format', '{{.Id}}', $local) -Quiet).Output
        if ($old.ExitCode -eq 0 -and $old.Output -and $old.Output -ne $new) { Remove-IfUntagged $old.Output }
    }
}

function Write-PathWarnings([string]$FromSha, [string]$ToSha) {
    $files = @((Invoke-Git -Quiet -GitArgs @('diff', '--name-only', $FromSha, $ToSha)).Output -split "`n" | Where-Object { $_ })
    foreach ($group in @(@{ Level = 'WARN'; Map = $ManualPaths }, @{ Level = 'INFO'; Map = $InfoPaths })) {
        foreach ($pattern in $group.Map.Keys) {
            $hit = @($files | Where-Object { $_ -match $pattern })
            if ($hit.Count -gt 0) {
                Write-Log $group.Level "$($group.Map[$pattern]). Tệp: $($hit -join ', ')"
            }
        }
    }
}

# Lần đầu (chưa có state): thứ đang chạy là image build tại máy từ HEAD của checkout.
function Initialize-State([hashtable]$S) {
    if (-not $S.ContainsKey('deployed_kind') -or -not (Get-Val $S 'deployed_kind')) {
        $head = (Invoke-Git -Quiet -GitArgs @('rev-parse', 'HEAD')).Output
        $S['deployed_kind'] = 'build_prod'
        $S['deployed_tag'] = ''
        $S['deployed_sha'] = $head
        $S['checkout_sha'] = $head
        $S['last_result'] = 'bootstrap'
        Write-Log 'INFO' "Chưa có state — coi $(Short $head) (image build tại máy) là bản đang chạy."
    }
}

# ─── Deploy một bản ──────────────────────────────────────────────────────────

function Invoke-Deploy([hashtable]$State, [string]$DKind, [string]$DTag, [string]$DSha) {
    $label = "$DKind $(Short $DTag)"
    Set-Job 'running' "Đang deploy $DTag"
    Write-Log 'INFO' "===== DEPLOY $label ====="
    $blocked = @()
    $headSha = (Invoke-Git -Quiet -GitArgs @('rev-parse', 'HEAD')).Output
    $gitAction = 'none'

    # ── Git: commit phải thuộc build_prod; chỉ dời checkout bằng fast-forward
    if ($true) {
        $branchNow = (Invoke-Git -Quiet -GitArgs @('rev-parse', '--abbrev-ref', 'HEAD')).Output
        if ($branchNow -ne $Branch) { $blocked += "checkout đang ở nhánh '$branchNow', không phải '$Branch'" }
        $tip = Get-FetchedTip
        if (-not $tip) {
            $blocked += "git fetch $Remote $Branch lỗi (mạng?)"
        } elseif ((Invoke-Git -Quiet -GitArgs @('merge-base', '--is-ancestor', $DSha, $tip)).ExitCode -ne 0) {
            $blocked += "commit $(Short $DSha) không thuộc lịch sử $Remote/$Branch"
        } elseif ($DSha -eq $headSha) {
            $gitAction = 'none'
        } elseif ((Invoke-Git -Quiet -GitArgs @('merge-base', '--is-ancestor', $headSha, $DSha)).ExitCode -eq 0) {
            $gitAction = 'ff'
        } elseif ((Invoke-Git -Quiet -GitArgs @('merge-base', '--is-ancestor', $DSha, $headSha)).ExitCode -eq 0) {
            Write-Log 'WARN' "$(Short $DSha) cũ hơn checkout $(Short $headSha): chỉ đổi image, checkout (và docker-compose.yml) giữ nguyên."
        } else {
            $blocked += "checkout $(Short $headSha) và $(Short $DSha) rẽ nhánh — không fast-forward được, xử lý tay"
        }
        if ($gitAction -eq 'ff') {
            $dirty = (Invoke-Git -Quiet -GitArgs @('status', '--porcelain', '--untracked-files=no')).Output
            if ($dirty) { $blocked += "working tree có thay đổi chưa commit:`n$dirty" }
        }
    }

    # ── Image phải có đủ trên GHCR (manifest inspect chỉ hỏi registry, không tải layer)
    $missing = Get-MissingImages $DTag
    if ($missing.Count -gt 0) {
        $blocked += "thiếu image $DTag trên GHCR: $($missing -join ', ') (package private -> docker login ghcr.io, README)"
    }

    # ── Đĩa: ổ D: đầy từng làm sập production (15/11)
    $drive = Get-PSDrive -Name $DockerDrive -PSProvider FileSystem -ErrorAction SilentlyContinue
    if ($drive) {
        $freeGB = [math]::Round($drive.Free / 1GB, 1)
        if ($freeGB -lt $MinFreeGB) { $blocked += "ổ ${DockerDrive}: còn $freeGB GB < $MinFreeGB GB" }
    } else {
        Write-Log 'WARN' "Không đọc được dung lượng ổ ${DockerDrive}: — bỏ qua kiểm tra đĩa."
    }

    # ── DB: deploy không đụng DB (SERVER_DB_PREP=off) -> bản cần migration chưa áp thì chặn
    $pending = Get-PendingMigrations $DSha
    if ($null -eq $pending) {
        $blocked += 'không đọc được danh sách migration đã áp trong Postgres (_prisma_migrations) — không đoán, dừng'
    } elseif (@($pending).Count -gt 0) {
        $blocked += "bản $(Short $DSha) cần migration CHƯA áp vào DB: $(@($pending) -join ', '). Deploy không đụng DB — áp tay trước (deploy/cd/README.md, mục Migration) rồi deploy lại"
    } else {
        Write-Log 'INFO' 'Migration: DB đã có đủ migration của bản này — deploy chỉ thay code.'
    }

    if ($blocked.Count -gt 0) {
        $text = $blocked -join '; '
        if ($Poll) {
            # -Poll gặp lại mỗi 2 phút: ghi log một lần; không đánh dấu lỗi vì có thể chỉ tạm thời
            Write-Notice $State "blocked-$DTag-$($text.GetHashCode())" 'ERROR' "Chặn deploy $label`: $text"
        } else {
            foreach ($b in $blocked) { Write-Log 'ERROR' "Chặn: $b" }
        }
        if (-not $DryRun) {
            $State['last_result'] = 'rejected'
            Save-State $State
            Set-Job 'rejected' ("Không deploy (chưa đổi gì): " + ($blocked -join '; '))
            return 1
        }
        Write-Log 'WARN' 'Lượt thật sẽ DỪNG ở các kiểm tra trên; phần dưới chỉ để xem trước.'
    }

    if ($gitAction -eq 'ff') { Write-PathWarnings $headSha $DSha }

    # ── Kéo image TRƯỚC khi đụng bất cứ gì: lỗi mạng ở đây không để lại gì dở dang
    foreach ($svc in $Services) {
        $p = Invoke-Exe -Mutating -Exe 'docker' -Arguments @('pull', '--quiet', '--platform', 'linux/amd64', (Get-ImageRef $svc $DTag))
        if ($p.ExitCode -ne 0) {
            Set-Job 'failed' "Kéo image $svc lỗi — chưa thay đổi gì"
            return 1
        }
    }

    $snapshot = Save-RunningImages

    if ($gitAction -eq 'ff') {
        $m = Invoke-Git -Mutating -GitArgs @('merge', '--ff-only', '--quiet', $DSha)
        if ($m.ExitCode -ne 0) {
            Set-Job 'failed' 'git merge --ff-only lỗi — chưa thay đổi container'
            return 1
        }
    }

    $env:IMAGE_TAG = $DTag
    $deployOk = $true
    $reason = ''
    $health = ''
    try {
        # Chỉ đọc file; --quiet chỉ in lỗi (tên biến thiếu), không in giá trị nào của .env
        $c = Invoke-Compose -Quiet -ComposeArgs @('config', '--quiet')
        if ($c.ExitCode -ne 0) {
            if (-not $DryRun) { throw 'docker-compose.yml/.env không hợp lệ (xem deploy.log)' }
            Write-Log 'WARN' "compose config lỗi (lượt thật sẽ rollback ở đây): $($c.Output)"
        }
        Start-AppServices -Only $Services
        $health = Wait-Healthy
        if (-not $script:HealthOk) { throw $health }
    } catch {
        $reason = $_.Exception.Message
        Write-Log 'ERROR' "Deploy $label thất bại: $reason"
        $deployOk = $false
    }

    if (-not $deployOk) {
        $resetTo = ''
        if ($gitAction -eq 'ff') { $resetTo = $headSha }
        $rbHealth = Invoke-Rollback -ResetTo $resetTo -ImageTag 'rollback' -Only $snapshot
        $State['failed_tag'] = $DTag
        $State['failed_at'] = (Get-Date).ToString('o')
        if ($script:RollbackOk) {
            $State['last_result'] = 'rolled_back'
            Set-Job 'rolled_back' "Deploy $DTag lỗi: $reason. Đã rollback về bản trước — $rbHealth"
        } else {
            $State['last_result'] = 'rollback_failed'
            Set-Job 'rollback_failed' "Deploy $DTag lỗi: $reason. Rollback KHÔNG trọn — $rbHealth. Cần xử lý tay."
        }
        $State['notice'] = $null
        Save-State $State
        return 1
    }

    # ── Thành công
    Set-LocalAlias $DTag
    $prevTag = Get-Val $State 'deployed_tag'
    $State['previous_kind'] = Get-Val $State 'deployed_kind'
    $State['previous_tag'] = $prevTag
    $State['previous_sha'] = Get-Val $State 'deployed_sha'
    $State['previous_checkout_sha'] = $headSha
    $State['deployed_kind'] = $DKind
    $State['deployed_tag'] = $DTag
    $State['deployed_sha'] = $DSha
    $State['deployed_at'] = (Get-Date).ToString('o')
    $State['checkout_sha'] = (Invoke-Git -Quiet -GitArgs @('rev-parse', 'HEAD')).Output
    $State['failed_tag'] = $null
    $State['last_result'] = 'deployed'
    $State['notice'] = $null
    Save-State $State
    Write-Log 'INFO' "===== DEPLOY XONG: $label ====="
    if ($DryRun -and $blocked.Count -gt 0) {
        Set-Job 'rejected' ("[dry-run] lượt thật sẽ bị chặn: " + ($blocked -join '; '))
    } else {
        Set-Job 'succeeded' "Đã deploy $DTag — $health"
    }

    $keep = @($DTag)
    if ($prevTag) { $keep += $prevTag }
    Remove-OldImages -Keep $keep
    return 0
}

# ─── Các chế độ ──────────────────────────────────────────────────────────────

function Invoke-ManualRollback([hashtable]$State) {
    $prevTag = Get-Val $State 'previous_tag'
    $prevKind = Get-Val $State 'previous_kind'
    $prevCheckout = Get-Val $State 'previous_checkout_sha'
    $curTag = Get-Val $State 'deployed_tag'
    if (-not $prevKind) {
        Write-Log 'ERROR' 'state.json chưa có bản trước để quay về.'
        return 1
    }
    $head = (Invoke-Git -Quiet -GitArgs @('rev-parse', 'HEAD')).Output
    $resetTo = ''
    if ($prevCheckout -and $prevCheckout -ne $head) { $resetTo = $prevCheckout }
    Write-Log 'INFO' "Rollback tay: $curTag -> $prevTag"
    $health = Invoke-Rollback -ResetTo $resetTo -ImageTag $prevTag -Only $Services
    $State['failed_tag'] = $curTag
    $State['failed_at'] = (Get-Date).ToString('o')
    $State['deployed_kind'] = $prevKind
    $State['deployed_tag'] = $prevTag
    $State['deployed_sha'] = Get-Val $State 'previous_sha'
    $State['checkout_sha'] = (Invoke-Git -Quiet -GitArgs @('rev-parse', 'HEAD')).Output
    foreach ($k in 'previous_kind', 'previous_tag', 'previous_sha', 'previous_checkout_sha') { $State[$k] = $null }
    $State['last_result'] = $(if ($script:RollbackOk) { 'manual_rollback' } else { 'manual_rollback_incomplete' })
    Save-State $State
    Write-Log 'INFO' "Rollback tay: $health"
    if ($script:RollbackOk) { return 0 } else { return 1 }
}

function Invoke-PollMode([hashtable]$State) {
    $branchNow = (Invoke-Git -Quiet -GitArgs @('rev-parse', '--abbrev-ref', 'HEAD')).Output
    if ($branchNow -ne $Branch) {
        Write-Notice $State "branch-$branchNow" 'ERROR' "Checkout đang ở nhánh '$branchNow', không phải '$Branch' — không deploy."
        Save-State $State; return 1
    }
    $remoteSha = Get-FetchedTip
    if (-not $remoteSha) {
        Write-Notice $State 'fetch' 'WARN' 'git fetch lỗi (mạng?) — thử lại lượt sau.'
        Save-State $State; return 0
    }
    $newTag = "sha-$remoteSha"
    if (-not $Force) {
        if ((Get-Val $State 'deployed_kind') -eq 'build_prod' -and (Get-Val $State 'deployed_sha') -eq $remoteSha) {
            if ($DryRun) { Write-Log 'INFO' "Không có gì mới: $Branch = $(Short $remoteSha) đã deploy." }
            Save-State $State; return 0
        }
        if ((Get-Val $State 'failed_tag') -eq $newTag) {
            if ($DryRun) { Write-Log 'INFO' "$newTag đã lỗi trước đó — chờ commit mới hoặc -Force." }
            Save-State $State; return 0
        }
    }

    # Cổng CI. Đã thành công thì nhớ; đang chờ hỏi tối đa ~4 phút/lần, lỗi 10 phút/lần —
    # giữ xa giới hạn 60 request/giờ (re-run CI thành công vẫn được thấy).
    $gateSha = Get-Val $State 'gate_sha'
    $gateStatus = Get-Val $State 'gate_status'
    $gateAt = Get-Val $State 'gate_checked_at'
    if (-not $DryRun -and $gateSha -eq $remoteSha -and $gateStatus -eq 'success') {
        $ci = [pscustomobject]@{ Status = 'success'; Detail = '(đã xác nhận ở lượt trước)' }
    } else {
        if (-not $DryRun -and -not $Force -and $gateSha -eq $remoteSha -and $gateAt) {
            $age = ((Get-Date) - [datetime]::Parse($gateAt)).TotalSeconds
            $wait = 230
            if ($gateStatus -eq 'failure') { $wait = 600 }
            if ($age -lt $wait) { Save-State $State; return 0 }
        }
        $ci = Get-CiStatus $remoteSha
        $State['gate_sha'] = $remoteSha
        $State['gate_status'] = $ci.Status
        $State['gate_checked_at'] = (Get-Date).ToString('o')
    }
    if ($ci.Status -ne 'success') {
        $level = 'INFO'
        if ($ci.Status -eq 'failure') { $level = 'ERROR' } elseif ($ci.Status -eq 'unknown') { $level = 'WARN' }
        Write-Notice $State "ci-$remoteSha-$($ci.Status)" $level "Chưa deploy $(Short $remoteSha): $($ci.Detail)"
        if (-not $DryRun) { Save-State $State; return 0 }
    } else {
        Write-Log 'INFO' "CI của $(Short $remoteSha) thành công: $($ci.Detail)"
    }
    # Image chưa có đủ (vd. package private chưa login): báo một lần, thử lại lượt sau
    if (-not $DryRun -and (Get-MissingImages $newTag).Count -gt 0) {
        Write-Notice $State "img-$remoteSha" 'WARN' "Thiếu image $newTag trên GHCR (package private -> docker login ghcr.io)."
        Save-State $State; return 0
    }
    return Invoke-Deploy $State 'build_prod' $newTag $remoteSha
}

function Invoke-Main {
    $state = Read-JsonFile $StateFile
    $state['last_check'] = (Get-Date).ToString('o')

    if (-not (Test-Path (Join-Path $RepoDir '.git'))) {
        Write-Log 'ERROR' "Không thấy repo git ở $RepoDir"
        Set-Job 'rejected' 'Máy deploy cấu hình sai (không thấy repo)'
        return 1
    }
    if ((Invoke-Exe -Exe 'docker' -Arguments @('version', '--format', '{{.Server.Version}}') -Quiet).ExitCode -ne 0) {
        Write-Notice $state 'no-docker' 'WARN' 'Docker chưa chạy (Docker Desktop tắt?).'
        Save-State $state
        Set-Job 'rejected' 'Docker trên máy deploy chưa chạy'
        return 1
    }
    Initialize-State $state

    if ($Rollback) { return Invoke-ManualRollback $state }
    if ($Poll) { return Invoke-PollMode $state }

    if (-not $Tag) {
        Write-Log 'ERROR' 'Chọn một chế độ: -Tag <tag> -Kind build_prod|pr, -Poll, hoặc -Rollback (Get-Help .\pull-deploy.ps1).'
        return 2
    }
    # Kiểm lại dữ liệu kể cả khi listener đã kiểm: script này cũng được gọi tay
    $why = ''
    if ($Tag -notmatch $TagPattern) { $why = "tag '$Tag' sai dạng" }
    elseif ($Tag -notmatch '^sha-([0-9a-f]{40})$') { $why = 'cần tag sha-<đủ 40 ký tự>' }
    elseif ($Sha -and $Sha -ne $Matches[1]) { $why = 'sha không khớp tag' }
    else { $Sha = $Matches[1] }
    if ($why) {
        Write-Log 'ERROR' "Yêu cầu không hợp lệ: $why"
        Set-Job 'rejected' "Yêu cầu không hợp lệ: $why"
        return 2
    }
    return Invoke-Deploy $state $Kind $Tag $Sha
}

# ─── Khoá: mỗi lúc chỉ một lượt deploy (Windows tự nhả khi tiến trình chết) ──
New-Item -ItemType Directory -Force -Path $StateDir | Out-Null
$lock = $null
for ($i = 0; $i -lt 60 -and -not $lock; $i++) {
    try {
        $lock = [IO.File]::Open($LockFile, [IO.FileMode]::OpenOrCreate, [IO.FileAccess]::ReadWrite, [IO.FileShare]::None)
    } catch {
        # -Poll chạy theo lịch: có lượt khác thì bỏ qua. Deploy theo yêu cầu: chờ tối đa 10 phút.
        if ($Poll) { Write-Host 'Một lượt deploy khác đang chạy — bỏ qua.'; exit 0 }
        Start-Sleep -Seconds 10
    }
}
if (-not $lock) {
    Write-Log 'ERROR' 'Chờ khoá deploy quá 10 phút — bỏ yêu cầu.'
    Set-Job 'failed' 'Máy deploy đang bận quá lâu (khoá deploy)'
    exit 1
}

$exitCode = 1
try {
    # Phòng hàm nào lỡ đẩy thêm giá trị ra pipeline: mã thoát là giá trị cuối cùng
    $exitCode = [int](@(Invoke-Main) | Select-Object -Last 1)
} catch {
    Write-Log 'ERROR' ("Lỗi không lường trước: $($_.Exception.Message) " + $_.InvocationInfo.PositionMessage)
    Set-Job 'failed' 'Lỗi không lường trước trên máy deploy (xem deploy.log)'
    $exitCode = 1
} finally {
    $lock.Dispose()
}
exit $exitCode
