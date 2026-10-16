Write-Host "====================================================" -ForegroundColor Cyan
Write-Host "             DMS Software Auto-Update               " -ForegroundColor Cyan
Write-Host "====================================================" -ForegroundColor Cyan

Write-Host "`n[1/4] Stopping DMS services..." -ForegroundColor Yellow
Stop-Service -Name "*dms*" -Force -ErrorAction SilentlyContinue

Write-Host "`n[2/4] Fetching latest release package..." -ForegroundColor Yellow
git sparse-checkout init --no-cone 2>$null
git sparse-checkout set "/dist.zip" "/update-server.bat" "/update-server.ps1" 2>$null
git fetch origin main
git reset --hard origin/main

Write-Host "Cleaning development files..." -ForegroundColor Gray
Get-ChildItem -File | Where-Object { $_.Name -notin @('.env', 'update-server.bat', 'update-server.ps1', 'dist.zip') } | Remove-Item -Force -ErrorAction SilentlyContinue
Get-ChildItem -Directory | Where-Object { $_.Name -notin @('dist', 'node_modules', 'uploads', 'pdfs') } | Remove-Item -Recurse -Force -ErrorAction SilentlyContinue

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
