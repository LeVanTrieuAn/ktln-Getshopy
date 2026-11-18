<#
.SYNOPSIS
    Đăng ký / gỡ task Windows chạy bộ deploy của Getshopy dưới tài khoản hiện tại (không cần admin).

.DESCRIPTION
    Mặc định: task "Getshopy-CD-Listener" chạy webhook-listener.ps1
      - khi đăng nhập, và mỗi 5 phút (MultipleInstances = IgnoreNew: đang chạy thì bỏ qua,
        listener chết thì lần kích hoạt sau dựng lại) + Restart-on-failure 1 phút;
      - không giới hạn thời gian chạy; cửa sổ ẩn (conhost --headless).
    Chỉ chạy khi người dùng đã đăng nhập — Docker Desktop cũng chỉ chạy khi đó.

    -Poll: thay vào đó đăng ký task "Getshopy-CD-Poll" chạy pull-deploy.ps1 -Poll mỗi 2 phút
    (dự phòng khi không dùng webhook; chỉ deploy commit build_prod đã có sẵn image sha-*).
    Không cần bật cả hai.

.EXAMPLE
    .\register-task.ps1 -RunNow          # đăng ký listener và khởi động ngay
    .\register-task.ps1 -Unregister      # gỡ listener
    .\register-task.ps1 -Poll            # (dự phòng) đăng ký chế độ hỏi định kỳ
    .\register-task.ps1 -Poll -Unregister
#>
[CmdletBinding()]
param(
    [switch]$Poll,
    [switch]$Unregister,
    [switch]$RunNow,
    [string]$RepoDir = 'C:\Users\AD\Desktop\TDTU 2023-2024\KLTN\ktln-Getshopy',
    [string]$Branch = 'build_prod',
    [int]$Port = 18095,
    [int]$PollMinutes = 2,
    [string]$TaskPath = '\Getshopy\'
)

$ErrorActionPreference = 'Stop'

if ($Poll) {
    $TaskName = 'Getshopy-CD-Poll'
    $script = Join-Path $PSScriptRoot 'pull-deploy.ps1'
    $scriptArgs = "-Poll -RepoDir `"$RepoDir`" -Branch $Branch"
} else {
    $TaskName = 'Getshopy-CD-Listener'
    $script = Join-Path $PSScriptRoot 'webhook-listener.ps1'
    $scriptArgs = "-Port $Port -RepoDir `"$RepoDir`" -Branch $Branch"
}

if ($Unregister) {
    if (Get-ScheduledTask -TaskName $TaskName -TaskPath $TaskPath -ErrorAction SilentlyContinue) {
        Stop-ScheduledTask -TaskName $TaskName -TaskPath $TaskPath -ErrorAction SilentlyContinue
        Unregister-ScheduledTask -TaskName $TaskName -TaskPath $TaskPath -Confirm:$false
        Write-Host "Đã gỡ task $TaskPath$TaskName"
    } else {
        Write-Host "Không có task $TaskPath$TaskName"
    }
    return
}

if (-not (Test-Path $script)) { throw "Không thấy $script" }
if (-not $Poll -and -not (Test-Path (Join-Path $env:LOCALAPPDATA 'getshopy-cd\webhook.secret'))) {
    Write-Warning 'Chưa có %LOCALAPPDATA%\getshopy-cd\webhook.secret — listener sẽ thoát ngay. Tạo theo README trước.'
}

# conhost --headless: chạy PowerShell không hiện cửa sổ (Windows 11). -WindowStyle Hidden vẫn
# nháy cửa sổ, nhất là khi Windows Terminal là terminal mặc định.
$conhost = Join-Path $env:WINDIR 'System32\conhost.exe'
$psArgs = "--headless powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File `"$script`" $scriptArgs"
$action = New-ScheduledTaskAction -Execute $conhost -Argument $psArgs -WorkingDirectory $PSScriptRoot

$user = "$env:USERDOMAIN\$env:USERNAME"
$principal = New-ScheduledTaskPrincipal -UserId $user -LogonType Interactive -RunLevel Limited

if ($Poll) {
    # Không đặt RepetitionDuration = lặp vô thời hạn
    $triggers = @(New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) -RepetitionInterval (New-TimeSpan -Minutes $PollMinutes))
    $settings = New-ScheduledTaskSettingsSet -MultipleInstances IgnoreNew -StartWhenAvailable `
        -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit (New-TimeSpan -Minutes 30)
} else {
    $triggers = @(
        (New-ScheduledTaskTrigger -AtLogOn -User $user),
        # Lưới an toàn: listener chết vì lý do gì thì tối đa 5 phút sau được dựng lại
        (New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) -RepetitionInterval (New-TimeSpan -Minutes 5))
    )
    $settings = New-ScheduledTaskSettingsSet -MultipleInstances IgnoreNew -StartWhenAvailable `
        -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit ([TimeSpan]::Zero) `
        -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1)
}

Register-ScheduledTask -TaskName $TaskName -TaskPath $TaskPath -Action $action -Trigger $triggers `
    -Principal $principal -Settings $settings -Force `
    -Description 'Getshopy CD — xem deploy/cd/README.md' | Out-Null
Write-Host "Đã đăng ký $TaskPath$TaskName ($user): $script $scriptArgs"

if ($RunNow) {
    Start-ScheduledTask -TaskName $TaskName -TaskPath $TaskPath
    Write-Host 'Đã khởi động. Log: %LOCALAPPDATA%\getshopy-cd\'
}
