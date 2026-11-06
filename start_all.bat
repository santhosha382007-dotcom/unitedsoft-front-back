@echo off
title UnitedSoft Attendance System - One-Click Launcher
color 0F
echo ======================================================================
echo          UNITEDSOFT MOBILE ATTENDANCE ^& AUTOMATED PAYROLL
echo ======================================================================
echo.
echo [*] Checking Environment Prerequisites...

where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Node.js is not found in PATH. Please install Node.js v18 or higher.
    pause
    exit /b 1
)

echo [OK] Node.js detected.
echo.
echo [*] Step 1: Starting Database ^& Backend REST API on Port 5000...
start "UnitedSoft Backend and DB" cmd /k "%~dp0start_database.bat"

echo [*] Waiting 3 seconds for Backend ^& Database initialization...
timeout /t 3 /nobreak >nul 2>nul || ping -n 4 127.0.0.1 >nul

echo [*] Step 2: Starting Cross-Platform Mobile App (Expo)...
start "UnitedSoft Mobile App" cmd /k "%~dp0start_mobile_app.bat"

set LAN_IP=
for /f "tokens=4" %%a in ('route print 0.0.0.0 ^| findstr /c:" 0.0.0.0 "') do if not defined LAN_IP set LAN_IP=%%a
if not defined LAN_IP set LAN_IP=10.227.109.116

echo.
echo ======================================================================
echo  SERVICES LAUNCHED SUCCESSFULLY!
echo ======================================================================
echo.
echo  Backend API (Local PC):    http://localhost:5000
echo  Backend API (Phone Wi-Fi): http://%LAN_IP%:5000
echo  Health Check URL:          http://%LAN_IP%:5000/api/health
echo  Mobile App:                Check the opened Expo window!
echo                             - Press 'w' in Expo window for Web preview
echo                             - Scan QR code using Expo Go app on phone
echo.
echo  Demo Credentials:
echo    HR / Admin:   admin@unitedsoft.com  /  admin123
echo    Employee:     alex@unitedsoft.com   /  emp123
echo.
echo  *Note for Phone:
echo    - Ensure phone and PC are connected to the same Wi-Fi.
echo    - If phone cannot connect, double-click 'fix_phone_connection.bat'
echo    - Or run 'start_tunnel_mode.bat' to connect through cloud tunnel
echo.
echo ======================================================================
echo  Leave this window or close it when done.
echo.
pause

