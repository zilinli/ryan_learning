@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title QiZhi Tutor

if not exist "logs" mkdir "logs"
set "LOG=%~dp0logs\last-start.txt"
> "%LOG%" echo ==== start %date% %time% ====
>> "%LOG%" echo cwd=%cd%

set "NODE_EXE="
where node >nul 2>nul && for /f "delims=" %%i in ('where node') do (
  if not defined NODE_EXE set "NODE_EXE=%%i"
)
if not defined NODE_EXE if exist "%ProgramFiles%\nodejs\node.exe" set "NODE_EXE=%ProgramFiles%\nodejs\node.exe"
if not defined NODE_EXE if exist "%LocalAppData%\Programs\nodejs\node.exe" set "NODE_EXE=%LocalAppData%\Programs\nodejs\node.exe"
if not defined NODE_EXE (
  echo [ERROR] Node.js not found. Install LTS from https://nodejs.org/
  >> "%LOG%" echo ERROR: node not found
  pause
  exit /b 1
)

set "NPM_CMD="
where npm.cmd >nul 2>nul && for /f "delims=" %%i in ('where npm.cmd') do (
  if not defined NPM_CMD set "NPM_CMD=%%i"
)
if not defined NPM_CMD if exist "%ProgramFiles%\nodejs\npm.cmd" set "NPM_CMD=%ProgramFiles%\nodejs\npm.cmd"
if not defined NPM_CMD if exist "%LocalAppData%\Programs\nodejs\npm.cmd" set "NPM_CMD=%LocalAppData%\Programs\nodejs\npm.cmd"
if not defined NPM_CMD (
  echo [ERROR] npm.cmd not found
  >> "%LOG%" echo ERROR: npm not found
  pause
  exit /b 1
)

echo [QiZhi] Node:
"%NODE_EXE%" -v
>> "%LOG%" "%NODE_EXE%" -v

if not exist "node_modules\next" (
  echo [QiZhi] Installing dependencies, please wait...
  call "%NPM_CMD%" install --registry https://registry.npmmirror.com >> "%LOG%" 2>&1
  if errorlevel 1 (
    echo [ERROR] npm install failed. See logs\last-start.txt
    pause
    exit /b 1
  )
)

echo [QiZhi] Preparing env...
"%NODE_EXE%" "%~dp0scripts\ensure-env.mjs" >> "%LOG%" 2>&1
if errorlevel 1 (
  echo [ERROR] ensure-env failed. See logs\last-start.txt
  type "%LOG%"
  pause
  exit /b 1
)

echo [QiZhi] Starting server...
echo Browser will open http://localhost:3000
echo Close this window to stop.
echo.

rem Free stale Next.js on this project / port 3000
for /f "tokens=5" %%p in ('netstat -ano ^| findstr ":3000" ^| findstr "LISTENING"') do (
  >> "%LOG%" echo killing pid %%p on port 3000
  taskkill /PID %%p /F >nul 2>nul
)
if exist "%~dp0.next\dev\lock" del /f /q "%~dp0.next\dev\lock" >nul 2>nul

start "" "%SystemRoot%\System32\cmd.exe" /c "ping -n 4 127.0.0.1 >nul & start http://localhost:3000"

call "%NPM_CMD%" run dev
set "ERR=%ERRORLEVEL%"
echo.
echo [QiZhi] stopped code=%ERR%
>> "%LOG%" echo stopped code=%ERR%
if not "%ERR%"=="0" echo See logs\last-start.txt
pause
exit /b %ERR%
