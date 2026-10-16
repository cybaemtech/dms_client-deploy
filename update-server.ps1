Write-Host "====================================================" -ForegroundColor Cyan
Write-Host "             DMS Software Auto-Update               " -ForegroundColor Cyan
Write-Host "====================================================" -ForegroundColor Cyan

Write-Host "`n[1/3] Pulling latest code and build from Git..." -ForegroundColor Yellow
git pull origin main
if ($LASTEXITCODE -ne 0) {
    Write-Host "[ERROR] Git pull failed." -ForegroundColor Red
    exit $LASTEXITCODE
}

Write-Host "`n[2/3] Applying fresh production build from dist.zip..." -ForegroundColor Yellow
try {
    Expand-Archive -Path dist.zip -DestinationPath dist -Force
    Write-Host "✓ Extracted dist.zip successfully." -ForegroundColor Green
} catch {
    Write-Host "[WARNING] PowerShell extraction failed, running npm run build..." -ForegroundColor Yellow
    npm run build
}

Write-Host "`n[3/3] Restarting DMS services..." -ForegroundColor Yellow
Get-Service -Name "*dms*" -ErrorAction SilentlyContinue | ForEach-Object {
    Write-Host "Restarting service $($_.Name)..."
    Restart-Service -Name $_.Name -Force
}

if (Get-Command pm2 -ErrorAction SilentlyContinue) {
    pm2 reload dms
}

Write-Host "`n====================================================" -ForegroundColor Green
Write-Host "        DMS has been updated successfully!          " -ForegroundColor Green
Write-Host "====================================================" -ForegroundColor Green
