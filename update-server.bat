@echo off
setlocal
echo ====================================================
echo             DMS Software Auto-Update
echo ====================================================

echo [1/4] Stopping DMS Node service...
powershell -NoProfile -Command "Stop-Service -Name '*dms*' -Force -ErrorAction SilentlyContinue"

echo [2/4] Fetching latest production build...
git sparse-checkout init --cone >nul 2>&1
git sparse-checkout set dist.zip update-server.bat update-server.ps1 >nul 2>&1
git fetch origin main
git reset --hard origin/main

echo Cleaning development source folders...
powershell -NoProfile -Command "Remove-Item -Recurse -Force client, server, shared, scripts, attached_assets, .config -ErrorAction SilentlyContinue; Remove-Item -Force check_*.js, APPROVER_WORKFLOW_GUIDE*, .replit, *.ts -ErrorAction SilentlyContinue"

echo [3/4] Extracting production dist package...
if exist dist.zip (
    powershell -NoProfile -Command "Expand-Archive -Path dist.zip -DestinationPath dist -Force"
)

echo [4/4] Starting DMS Node service and IIS...
powershell -NoProfile -Command "Start-Service -Name '*dms*' -ErrorAction SilentlyContinue"
iisreset >nul 2>&1

echo ====================================================
echo        DMS has been updated successfully!
echo ====================================================
pause
