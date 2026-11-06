@echo off
title Push Full Stack (Frontend + Backend) to GitHub
color 0E
echo ========================================================
echo   PUSHING UNITEDSOFT (FRONTEND + BACKEND) TO GITHUB
echo ========================================================
echo.
cd /d "%~dp0"
echo [*] Current repository status:
git log -n 1 --oneline
echo.
echo [*] Pushing committed updates to GitHub (origin main)...
git push origin main
if %ERRORLEVEL% EQU 0 (
    echo.
    echo ========================================================
    echo  [SUCCESS] Full stack successfully pushed to GitHub!
    echo ========================================================
    echo  Repo: https://github.com/santhosha382007-dotcom/unitedsoft-front-back
    echo ========================================================
) else (
    echo.
    echo [NOTICE] If GitHub prompts for authentication:
    echo  - Sign in via your browser, or
    echo  - Enter your GitHub Personal Access Token (PAT).
)
echo.
pause
