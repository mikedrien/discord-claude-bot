@echo off
chcp 65001 >nul
title Discord Claude Bot - Setup

:: Check if Node.js exists
node --version >nul 2>&1
if errorlevel 1 (
    echo.
    echo  ============================================
    echo    Node.js nie je nainstalovany!
    echo  ============================================
    echo.
    echo    Stiahni a nainstaluj z: https://nodejs.org
    echo    Potrebujes verziu 18 alebo novsiu.
    echo    Po instalacii spusti tento subor znova.
    echo.
    pause
    exit /b 1
)

:: Run the interactive setup wizard
node "%~dp0setup.js"
if errorlevel 1 (
    echo.
    echo  Setup sa skoncil s chybou.
    echo.
    pause
    exit /b 1
)

pause
