@echo off
title UnitedSoft - Database Service Engine
color 0A
echo ========================================================
echo   UNITEDSOFT ATTENDANCE SYSTEM - DATABASE SERVICE
echo ========================================================
echo.

where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Node.js is not found in PATH. Please install Node.js v18 or higher.
    pause
    exit /b 1
)

cd /d "%~dp0backend"

echo [*] Checking for lingering processes on port 5000...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr /r /c:":5000 .*LISTENING"') do (
    echo [*] Freeing port 5000 from existing process PID %%a...
    taskkill /f /pid %%a >nul 2>nul
)

echo [*] Initializing Database Engine (SQLite Data Layer)...
echo [*] Checking Database Connectivity ^& Schema Migrations...
echo.

node -e "import('./src/db.js').then(m => { m.initDatabase(); console.log('[SUCCESS] Database initialized, tables verified, and demo records seeded.'); process.exit(0); }).catch(e => { console.error('[ERROR] Database initialization failed:', e); process.exit(1); })"

if %ERRORLEVEL% NEQ 0 (
    echo [!] Database startup encountered an issue.
    pause
    exit /b %ERRORLEVEL%
)

echo.
echo [OK] Database service is active and ready for REST API operations.
echo [*] Launching Backend REST Server with Database Engine...
echo.

call npm start

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERROR] Backend server stopped with error code %ERRORLEVEL%.
)

pause

