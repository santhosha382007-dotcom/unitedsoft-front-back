@echo off
title Push Backend Updates to GitHub & Render
color 0A
echo ========================================================
echo   PUSHING UNITEDSOFT BACKEND TO GITHUB & RENDER
echo ========================================================
echo.
cd /d "%~dp0backend"
echo [*] Current repository status:
git log -n 1 --oneline
echo.
echo [*] Pushing committed updates to GitHub (origin main)...
git push origin main
if %ERRORLEVEL% EQU 0 (
    echo.
    echo ========================================================
    echo  [SUCCESS] Backend updates successfully pushed to GitHub!
    echo ========================================================
    echo  Render auto-deploy is now triggered.
    echo  Live URL: https://unitedsoft-backend.onrender.com
    echo ========================================================
) else (
    echo.
    echo [NOTICE] If GitHub prompts for authentication:
    echo  - Sign in via your browser, or
    echo  - Enter your GitHub Personal Access Token (PAT).
)
echo.
pause
