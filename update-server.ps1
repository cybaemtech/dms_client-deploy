Write-Host "====================================================" -ForegroundColor Cyan
Write-Host "             DMS Software Auto-Update               " -ForegroundColor Cyan
Write-Host "====================================================" -ForegroundColor Cyan

Write-Host "`n[1/4] Stopping DMS services..." -ForegroundColor Yellow
Stop-Service -Name "*dms*" -Force -ErrorAction SilentlyContinue

Write-Host "`n[2/4] Fetching latest release package..." -ForegroundColor Yellow
git sparse-checkout init --cone 2>$null
git sparse-checkout set dist.zip update-server.bat update-server.ps1 2>$null
git fetch origin main
git reset --hard origin/main

Write-Host "Cleaning development source code..." -ForegroundColor Gray
Remove-Item -Recurse -Force client, server, shared, scripts, attached_assets, .config -ErrorAction SilentlyContinue
Remove-Item -Force check_*.js, APPROVER_WORKFLOW_GUIDE*, .replit, *.ts -ErrorAction SilentlyContinue

Write-Host "`n[3/4] Extracting production dist package..." -ForegroundColor Yellow
if (Test-Path "dist.zip") {
    Expand-Archive -Path dist.zip -DestinationPath dist -Force
    Write-Host "✓ Extracted production build into dist/" -ForegroundColor Green
}

Write-Host "`n[4/4] Starting DMS services..." -ForegroundColor Yellow
Start-Service -Name "*dms*" -ErrorAction SilentlyContinue
iisreset

Write-Host "`n====================================================" -ForegroundColor Green
Write-Host "        DMS has been updated successfully!          " -ForegroundColor Green
Write-Host "====================================================" -ForegroundColor Green
