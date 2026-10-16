Write-Host "====================================================" -ForegroundColor Cyan
Write-Host "             DMS Software Auto-Update               " -ForegroundColor Cyan
Write-Host "====================================================" -ForegroundColor Cyan

if (Test-Path "client/src") {
    Write-Host "[Build Machine Detected] Full source code present." -ForegroundColor Cyan
    Write-Host "`n[1/3] Pulling latest code and building..." -ForegroundColor Yellow
    git pull origin main
    npm run build
} else {
    Write-Host "[Client Server Detected] Updating production dist files only..." -ForegroundColor Cyan
    Write-Host "`n[1/3] Fetching latest dist package..." -ForegroundColor Yellow
    git fetch origin main
    git checkout origin/main -- dist.zip 2>$null
    if (Test-Path "dist.zip") {
        Write-Host "`n[2/3] Applying fresh production build from dist.zip..." -ForegroundColor Yellow
        Expand-Archive -Path dist.zip -DestinationPath . -Force
        Write-Host "✓ Extracted dist.zip successfully." -ForegroundColor Green
    }
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
