@echo off
title Push Frontend Updates to GitHub
color 0B
echo ========================================================
echo   PUSHING UNITEDSOFT FRONTEND TO GITHUB
echo ========================================================
echo.
cd /d "%~dp0mobile"
echo [*] Current repository status:
git log -n 1 --oneline
echo.
echo [*] Pushing committed updates to GitHub (origin main)...
git push origin main
if %ERRORLEVEL% EQU 0 (
    echo.
    echo ========================================================
    echo  [SUCCESS] Frontend updates successfully pushed to GitHub!
    echo ========================================================
    echo  Repo: https://github.com/santhosha382007-dotcom/United-Soft-frontend
    echo ========================================================
) else (
    echo.
    echo [NOTICE] If GitHub prompts for authentication:
    echo  - Sign in via your browser, or
    echo  - Enter your GitHub Personal Access Token (PAT).
)
echo.
pause
