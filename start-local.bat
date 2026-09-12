@echo off
setlocal
cd /d "%~dp0"
title QK80 MK2 Web Driver Local Server

echo ==================================================
echo   QK80 MK2 Web Driver - Local Server
echo   http://localhost:8080
echo ==================================================
echo.
echo Starting built-in PowerShell server...
echo Keep this window open while using the driver.
echo Press Ctrl+C to stop.
echo.

powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0start-local.ps1" -Port 8080

set "RC=%ERRORLEVEL%"
echo.
if not "%RC%"=="0" (
  echo [ERROR] Local server exited with code %RC%.
  echo Please copy the error text above and send it to me.
) else (
  echo Local server stopped.
)
echo.
pause
endlocal
