@echo off
setlocal EnableDelayedExpansion
chcp 65001 >nul 2>&1
REM ============================================================
REM  VIPER - Bioinformatics Audit Agent [start.bat]
REM  Double-click to launch. No manual env activation required.
REM ============================================================

title VIPER Audit Agent
cd /d "%~dp0"

REM --- Check virtual environment ---
if not exist ".venv\Scripts\python.exe" (
    echo.
    echo [INFO] Virtual environment not found. Running setup...
    echo.
    call setup.bat
    if errorlevel 1 (
        echo.
        echo [ERROR] Setup failed. See logs above.
        pause
        exit /b 1
    )
)

echo.
echo ============================================================
echo   VIPER Bioinformatics Audit Agent
echo   Native Desktop App - no browser required
echo ============================================================
echo [INFO] Launching VIPER...
echo [INFO] Close the application window to exit.
echo ============================================================
echo.

REM --- Launch as native desktop app (no console window) ---
start "" ".venv\Scripts\pythonw.exe" app.py

REM --- Wait briefly so user sees the launch message ---
timeout /t 3 /nobreak >nul
exit /b 0