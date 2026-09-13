# trigger_pipeline.ps1
Clear-Host
Write-Host "=======================================================================" -ForegroundColor Green
Write-Host "   BẮT ĐẦU KÍCH HOẠT TRIGGER DỮ LIỆU TỰ ĐỘNG KHỞI CHẠY (CHU KỲ 30 GIÂY)" -ForegroundColor Green
Write-Host "=======================================================================" -ForegroundColor Green

$chu_ky_giay            = 30
$clickhouse_containername = "clickhouse_local"
$clickhouse_client        = "clickhouse-client"

# Tạo thư mục log nếu chưa có
if (-not (Test-Path ".\dbt_warehouse\logs")) {
    New-Item -ItemType Directory -Path ".\dbt_warehouse\logs" | Out-Null
}

while ($true) {
    $thoi_gian = Get-Date -Format "HH:mm:ss"
    Write-Host ""
    Write-Host "[ $thoi_gian ] Kich hoat chu ky moi..." -ForegroundColor Cyan

    # -------------------------------------------------------------------------
    # BUOC 1: chay toan bo pipeline + audit models
    # -------------------------------------------------------------------------
    Set-Location dbt_warehouse
    Write-Host "[ $(Get-Date -Format 'HH:mm:ss') ] dbt run..." -ForegroundColor Cyan
    dbt run

    if ($LASTEXITCODE -ne 0) {
        Write-Host "[ $(Get-Date -Format 'HH:mm:ss') ] dbt run FAILED - bo qua chu ky nay" -ForegroundColor Red
        Set-Location ..
        Start-Sleep -Seconds $chu_ky_giay
        continue
    }

    # -------------------------------------------------------------------------
    # BUOC 2: chay dbt test
    # -------------------------------------------------------------------------
    Write-Host "[ $(Get-Date -Format 'HH:mm:ss') ] dbt test..." -ForegroundColor Cyan
    dbt test --select tag:audit

    if ($LASTEXITCODE -ne 0) {
        Write-Host "[ $(Get-Date -Format 'HH:mm:ss') ] dbt test co loi - xem logs/audit" -ForegroundColor Yellow
    }

    # -------------------------------------------------------------------------
    # BUOC 3: query ket qua checksum compare tu ClickHouse
    # -------------------------------------------------------------------------
    Write-Host "[ $(Get-Date -Format 'HH:mm:ss') ] Kiem tra checksum..." -ForegroundColor Cyan

    $query = "SELECT checked_at, domain, src_row_count, stg_row_count, wh_row_count, storage_row_diff, warehouse_row_diff, warehouse_sum_diff, stg_lag_minutes, wh_lag_minutes, status FROM audit_checksum_orders_compare ORDER BY checked_at DESC LIMIT 1 FORMAT Vertical"

    $ket_qua = docker exec $clickhouse_containername $clickhouse_client --query $query 2>&1

    Write-Host $ket_qua -ForegroundColor White

    # -------------------------------------------------------------------------
    # BUOC 4: parse status va alert
    # -------------------------------------------------------------------------
    if ($ket_qua -match "status:\s+OK") {
        Write-Host "[ $(Get-Date -Format 'HH:mm:ss') ] Checksum OK - 3 tang khop nhau" -ForegroundColor Green
    }
    elseif ($ket_qua -match "status:\s+(\S+)") {
        $status_val = $Matches[1]
        Write-Host "[ $(Get-Date -Format 'HH:mm:ss') ] CHECKSUM FAILED: $status_val" -ForegroundColor Red

        $log_line = "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') | $status_val | $ket_qua"
        Add-Content -Path ".\logs\checksum_failures.log" -Value $log_line
    }
    else {
        Write-Host "[ $(Get-Date -Format 'HH:mm:ss') ] Khong doc duoc status tu ClickHouse" -ForegroundColor Yellow
    }

    # -------------------------------------------------------------------------
    Set-Location ..
    Write-Host "[ $(Get-Date -Format 'HH:mm:ss') ] Nghi $chu_ky_giay giay..." -ForegroundColor Gray
    Start-Sleep -Seconds $chu_ky_giay
}