@echo off
title UnitedSoft - Tunnel Mode (Works on Any Network / Hotspot / Mobile Data)
color 0B
echo ======================================================================
echo    UNITEDSOFT ATTENDANCE - EXPO TUNNEL MODE
echo ======================================================================
echo.
echo  Tunnel Mode creates a secure cloud connection.
echo  * Works even when phone is on Mobile Data (4G/5G).
echo  * Works through firewalls, routers with AP isolation, and phone hotspots.
echo.

cd /d "%~dp0mobile"

echo [*] Launching Expo Bundler in Tunnel Mode...
echo [*] Once ready, scan the QR code using Expo Go on your phone!
echo.

call npx expo start --tunnel

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo [ERROR] Tunnel stopped with code %ERRORLEVEL%.
)

pause
