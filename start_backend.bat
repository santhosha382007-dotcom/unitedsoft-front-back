@echo off
title UnitedSoft - Backend REST API Server (Port 5000)
color 0B
echo ========================================================
echo   UNITEDSOFT ATTENDANCE SYSTEM - BACKEND REST API
echo ========================================================
echo.

where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Node.js is not found in PATH. Please install Node.js v18 or higher.
    pause
    exit /b 1
)

cd /d "%~dp0backend"

if not exist "node_modules\" (
    echo [ERROR] Backend dependencies are missing.
    echo [*] Please run install_packages.bat first.
    pause
    exit /b 1
)

echo [*] Checking for lingering processes on port 5000...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr /r /c:":5000 .*LISTENING"') do (
    echo [*] Freeing port 5000 from existing process PID %%a...
    taskkill /f /pid %%a >nul 2>nul
)

echo [*] Target Port: 5000
echo [*] Local API URL:   http://localhost:5000
echo [*] Health Check:    http://localhost:5000/api/health
echo [*] Launching Express REST Server with Real-Time Request Logging...
echo.

call npm start

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERROR] Backend server stopped with error code %ERRORLEVEL%.
)

pause
