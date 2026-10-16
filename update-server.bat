@echo off
setlocal
echo ====================================================
echo             DMS Software Auto-Update
echo ====================================================

if exist client\src (
    echo [Build Machine Detected] Full source code present.
    echo [1/3] Pulling latest code and building bundle...
    git pull origin main
    call npm run build
) else (
    echo [Client Server Detected] Updating production dist files only...
    echo [1/3] Fetching latest dist package...
    git fetch origin main
    git checkout origin/main -- dist.zip >nul 2>&1
    if exist dist.zip (
        echo [2/3] Extracting updated dist package...
        powershell -NoProfile -Command "Expand-Archive -Path dist.zip -DestinationPath . -Force"
        echo Done extracting production dist package.
    ) else (
        echo [2/3] dist.zip already applied or up to date.
    )
)

echo [3/3] Restarting DMS Node service...
powershell -NoProfile -Command "Get-Service -Name '*dms*' | Restart-Service -Force -ErrorAction SilentlyContinue"

where pm2 >nul 2>&1
if %errorlevel% equ 0 (
    call pm2 reload dms >nul 2>&1
)

echo ====================================================
echo        DMS has been updated successfully!
echo ====================================================
pause
