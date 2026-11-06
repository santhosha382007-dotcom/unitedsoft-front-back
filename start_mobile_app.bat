@echo off
title UnitedSoft - Cross-Platform Mobile App (Android / iOS / Web)
color 0E
echo ========================================================
echo   UNITEDSOFT MOBILE ATTENDANCE - REACT NATIVE EXPO
echo ========================================================
echo.

where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Node.js is not found in PATH. Please install Node.js v18 or higher.
    pause
    exit /b 1
)

cd /d "%~dp0mobile"

if not exist "node_modules\" (
    echo [ERROR] Mobile dependencies are missing.
    echo [*] Please run install_packages.bat first.
    pause
    exit /b 1
)

set LAN_IP=
for /f "tokens=4" %%a in ('route print 0.0.0.0 ^| findstr /c:" 0.0.0.0 "') do if not defined LAN_IP set LAN_IP=%%a
if defined LAN_IP (
    echo [*] Detected Wi-Fi / LAN IP: %LAN_IP%
    set REACT_NATIVE_PACKAGER_HOSTNAME=%LAN_IP%
) else (
    set REACT_NATIVE_PACKAGER_HOSTNAME=10.227.109.116
)

echo.
echo   Cross-Platform Single Codebase:
echo     [w] Press 'w' in Expo menu to open Web Browser preview
echo     [a] Press 'a' in Expo menu for Android emulator/device
echo     [i] Press 'i' in Expo menu for iOS simulator/device
echo     [s] Press 's' in Expo menu to switch to TUNNEL MODE (works on any network!)
echo     [QR] Scan the QR code with Expo Go app on your phone
echo.
echo   * Phone not connecting?
echo     - Run fix_phone_connection.bat (enables Windows Firewall & Private network)
echo     - Or run start_tunnel_mode.bat (cloud tunnel, works on mobile data/hotspot)
echo.
echo [*] Starting Expo Metro Bundler on %REACT_NATIVE_PACKAGER_HOSTNAME%...
echo.

call npm start

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERROR] Metro Bundler stopped with error code %ERRORLEVEL%.
)

pause
