@echo off
title UniStaff Management - Cloud Network Launcher
color 0A
echo ========================================================
echo        UNISTAFF MANAGEMENT - CLOUD NETWORK LAUNCHER
echo   Access from ANYWHERE on ANY Network (4G/5G/Wi-Fi/Remote)
echo ========================================================
echo.

cd /d "%~dp0backend"

echo [1/2] Starting UniStaff Backend Server on port 5000...
start "UniStaff Backend Server" cmd /k "node src/server.js"

echo Waiting 3 seconds for backend to initialize...
timeout /t 3 /nobreak >nul

echo.
echo [2/2] Launching Cloudflare Global Cloud Tunnel...
echo Establishing secure encrypted HTTPS public endpoint...
echo --------------------------------------------------------
echo NOTE: Below you will see your public Cloud URL:
echo       e.g. https://[random-subdomain].trycloudflare.com
echo       Share this URL or configure in the mobile app!
echo --------------------------------------------------------
echo.

cd /d "%~dp0"
"%~dp0cloudflared.exe" tunnel --url http://localhost:5000

pause
