@echo off
title UnitedSoft - Phone Connection Auto-Fix
color 0A
echo ======================================================================
echo    UNITEDSOFT - MOBILE PHONE CONNECTION AUTOMATED FIX
echo ======================================================================
echo.
echo  This tool configures Windows Firewall and your Wi-Fi network so your
echo  mobile phone can connect to the UnitedSoft Attendance System.
echo.
echo [*] Checking Administrator Privileges...

:: Check for permissions
net session >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [*] Elevating to Administrator...
    powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process cmd.exe -ArgumentList '/c \"\"%~f0\"\"' -Verb RunAs"
    exit /b
)

echo [OK] Running with Administrator Privileges.
echo.

:: Step 1: Change Wi-Fi to Private
echo [*] Step 1: Setting Wi-Fi network profile to Private...
powershell -NoProfile -Command "Get-NetConnectionProfile -InterfaceAlias 'Wi-Fi*' | Set-NetConnectionProfile -NetworkCategory Private" 2>nul
if %ERRORLEVEL% EQU 0 (
    echo     [SUCCESS] Wi-Fi profile set to Private (allows local device connections).
) else (
    echo     [INFO] Could not change Wi-Fi profile directly, checking firewall rules...
)

:: Step 2: Add Firewall rules for Backend (5000) and Expo/Metro (8081)
echo.
echo [*] Step 2: Adding Windows Defender Firewall rules for ports 5000 and 8081...
netsh advfirewall firewall delete rule name="UnitedSoft Backend API (Port 5000)" >nul 2>&1
netsh advfirewall firewall add rule name="UnitedSoft Backend API (Port 5000)" dir=in action=allow protocol=TCP localport=5000 profile=any >nul
echo     [SUCCESS] Port 5000 (Backend API) is now allowed in Firewall.

netsh advfirewall firewall delete rule name="UnitedSoft Metro Bundler (Port 8081)" >nul 2>&1
netsh advfirewall firewall add rule name="UnitedSoft Metro Bundler (Port 8081)" dir=in action=allow protocol=TCP localport=8081 profile=any >nul
echo     [SUCCESS] Port 8081 (Expo Metro Bundler) is now allowed in Firewall.

:: Step 3: Print current IP
set LAN_IP=
for /f "tokens=4" %%a in ('route print 0.0.0.0 ^| findstr /c:" 0.0.0.0 "') do if not defined LAN_IP set LAN_IP=%%a
if not defined LAN_IP set LAN_IP=10.227.109.116

echo.
echo ======================================================================
echo    SETUP COMPLETE! YOUR PHONE CAN NOW CONNECT:
echo ======================================================================
echo.
echo    Your Computer's Wi-Fi IP is: %LAN_IP%
echo.
echo    1. In Phone Browser (Chrome/Safari):
echo       http://%LAN_IP%:8081
echo.
echo    2. In Expo Go App (Android / iOS):
echo       Scan the QR code from the Expo window or enter:
echo       exp://%LAN_IP%:8081
echo.
echo    3. Test Backend Health on Phone:
echo       http://%LAN_IP%:5000/api/health
echo.
echo ======================================================================
pause
