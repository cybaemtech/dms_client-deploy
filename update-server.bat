@echo off
setlocal
echo ====================================================
echo             DMS Software Auto-Update
echo ====================================================

echo [1/4] Stopping DMS Node service...
powershell -NoProfile -Command "Stop-Service -Name '*dms*' -Force -ErrorAction SilentlyContinue"

echo [2/4] Fetching latest production build...
git sparse-checkout init --no-cone >nul 2>&1
git sparse-checkout set "/dist.zip" "/update-server.bat" "/update-server.ps1" >nul 2>&1
git fetch origin main
git reset --hard origin/main

echo Cleaning development files and folders...
powershell -NoProfile -Command "Get-ChildItem -File | Where-Object { $_.Name -notin @('.env', 'update-server.bat', 'update-server.ps1', 'dist.zip') } | Remove-Item -Force -ErrorAction SilentlyContinue; Get-ChildItem -Directory | Where-Object { $_.Name -notin @('dist', 'node_modules', 'uploads', 'pdfs') } | Remove-Item -Recurse -Force -ErrorAction SilentlyContinue"

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
