@echo off
title Web2APK Server
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
    echo Node.js was not found. Install it from https://nodejs.org and try again.
    pause
    exit /b 1
)

netstat -ano | findstr ":3000 " | findstr "LISTENING" >nul
if not errorlevel 1 (
    echo Web2APK is already running. Opening it in your browser...
    start "" http://localhost:3000
    ping -n 3 127.0.0.1 >nul
    exit /b 0
)

start "" cmd /c "ping -n 3 127.0.0.1 >nul & start http://localhost:3000"
node server.js
echo.
echo The Web2APK server has stopped.
pause
