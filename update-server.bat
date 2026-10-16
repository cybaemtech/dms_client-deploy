@echo off
setlocal
echo ====================================================
echo             DMS Software Auto-Update
echo ====================================================

echo [1/3] Pulling latest code and build from Git...
git pull origin main
if %errorlevel% neq 0 (
    echo [ERROR] Git pull failed. Check internet connection or git status.
    pause
    exit /b %errorlevel%
)

echo [2/3] Applying fresh production build from dist.zip...
powershell -NoProfile -Command "Expand-Archive -Path dist.zip -DestinationPath dist -Force"
if %errorlevel% neq 0 (
    echo [WARNING] Could not auto-extract dist.zip with PowerShell, attempting npm run build...
    call npm run build
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
