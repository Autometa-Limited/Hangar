@echo off
REM ============================================================
REM  Hangar — one-click starter
REM  Double-click this file to run the whole app.
REM  It starts the API (Docker) and the Web frontend (:3000).
REM  Keep this window OPEN while you use the app.
REM  To stop: close this window (or press Ctrl+C).
REM ============================================================

title Hangar (localhost:3000)

REM --- Use portable Node 22 (required) ---
set "PATH=D:\dev-ledger\node22;%PATH%"
set "HUSKY=0"
set "npm_config_verify_deps_before_run=false"

echo.
echo ============================================================
echo   Starting Hangar...
echo ============================================================
echo.

REM --- 1) Start the API (Docker container) ---
echo [1/2] Starting API (Docker)...
docker start project-management-setup-api-1 >nul 2>&1
if %errorlevel%==0 (
  echo       API container is up.
) else (
  echo       WARNING: could not start API container.
  echo       Make sure Docker Desktop is running, then re-run this file.
)
echo.

REM --- 2) Start the Web frontend on :3000 ---
echo [2/2] Starting Web on http://localhost:3000
echo       (first start takes ~30-60 sec to compile)
echo.
echo   >>> When you see "Local: http://localhost:3000/",
echo   >>> open that link in your browser.
echo.

cd /d "D:\dev-ledger\project-management-setup\apps\web"
call pnpm dev

echo.
echo ============================================================
echo   Web server stopped. You can close this window.
echo ============================================================
pause
