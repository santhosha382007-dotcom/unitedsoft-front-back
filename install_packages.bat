@echo off
title UnitedSoft - Package Installer & Dependency Verification
color 0B
echo ======================================================================
echo      UNITEDSOFT ATTENDANCE SYSTEM - INSTALLING ALL PACKAGES
echo ======================================================================
echo.

where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Node.js is not found in PATH.
    echo Please install Node.js from https://nodejs.org/ (v18+ recommended)
    pause
    exit /b 1
)

echo [OK] Node.js detected:
node -v
echo.

echo ======================================================================
echo  [1/2] Installing Backend Dependencies (Express, Mongoose, PDFKit)...
echo ======================================================================
cd /d "%~dp0backend"
call npm install
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Backend npm install failed!
    pause
    exit /b %ERRORLEVEL%
)
echo [OK] Backend dependencies installed successfully.
echo.

echo ======================================================================
echo  [2/2] Installing Mobile Dependencies (React Native, Expo, Icons)...
echo ======================================================================
cd /d "%~dp0mobile"
call npm install
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Mobile npm install failed!
    pause
    exit /b %ERRORLEVEL%
)
echo [OK] Mobile dependencies installed successfully.
echo.

echo ======================================================================
echo  [3/3] Verifying TypeScript Compilation...
echo ======================================================================
call npx tsc --noEmit
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] TypeScript compilation encountered errors!
    pause
    exit /b %ERRORLEVEL%
)

echo.
echo ======================================================================
echo  [SUCCESS] ALL REQUIRED PACKAGES ARE INSTALLED AND VERIFIED!
echo ======================================================================
echo.
echo  You can now start the application:
echo    - Run "start_all.bat" to start both Backend and Mobile App
echo    - Or run "start_database.bat" and "start_mobile_app.bat" separately
echo.
pause
